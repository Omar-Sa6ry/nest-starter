import {
  Inject,
  Logger,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';
import type { Server } from 'socket.io';
import { I18nService } from 'nestjs-i18n';
import { TOKEN_PROVIDER } from '../../../common/security/tokens/injection.tokens.js';
import type {
  ITokenPayload,
  ITokenProvider,
} from '../../../common/interfaces/ISecurity.interface.js';
import type { AuthenticatedSocket } from '../types/realtime.types.js';
import type { I18nTranslate } from '../types/i18n.types.js';
import {
  WS_DEFAULT_LANG,
  WS_EVENTS,
  WS_REALTIME_PATH,
  userRoom,
} from '../constants/realtime.constants.js';
import {
  WS_I18N,
  type WsI18nKey,
} from '../constants/realtime-i18n.constants.js';
import { extractToken, resolveLang } from '../utils/ws-handshake.util.js';
import { createWsEnvelope } from '../utils/ws-envelope.util.js';
import { wsError } from '../utils/ws-errors.util.js';
import { ConnectionService } from '../services/connection.service.js';
import { HeartbeatService } from '../services/heartbeat.service.js';
import { RealtimeMetricsService } from '../services/realtime-metrics.service.js';
import { WsAuthGuard } from './guards/ws-auth.guard.js';
import { WsRateLimitGuard } from './guards/ws-rate-limit.guard.js';
import { WsExceptionFilter } from './filters/ws-exception.filter.js';
import { WsResponseInterceptor } from './interceptors/ws-response.interceptor.js';
import {
  GetPresenceDto,
  RoomDto,
  SendRoomMessageDto,
} from '../dtos/ws-client-message.dto.js';
import { WsPermissions } from './decorators/ws-rbac.decorator.js';
import { Permission } from '../../../common/constant/enum.constant.js';

@WebSocketGateway({
  path: WS_REALTIME_PATH,
  cors: { origin: '*' },
})
@UseFilters(WsExceptionFilter)
@UseInterceptors(WsResponseInterceptor)
@UseGuards(WsAuthGuard, WsRateLimitGuard)
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    @Inject(TOKEN_PROVIDER)
    private readonly tokenProvider: ITokenProvider,
    private readonly connectionService: ConnectionService,
    private readonly heartbeatService: HeartbeatService,
    private readonly metrics: RealtimeMetricsService,
    @Inject(I18nService)
    private readonly i18n: I18nTranslate,
  ) {}

  afterInit(server: Server): void {
    this.heartbeatService.bindServer(server);
    this.logger.log(`Realtime gateway listening on ${WS_REALTIME_PATH}`);
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = extractToken(client.handshake);
    if (!token) {
      this.logger.warn(`Rejected unauthenticated socket: ${client.id}`);
      this.metrics.recordConnection('rejected_no_token');
      client.disconnect(true);
      return;
    }

    const user = await this.verify(token, client.id);
    if (!user) {
      this.metrics.recordConnection('rejected_invalid_token');
      client.disconnect(true);
      return;
    }

    // Frozen once here; every handler reads it and never re-verifies.
    client.data.user = user;
    client.data.lang = resolveLang(client.handshake);

    await this.connectionService.onConnect(user.userId, client.id);
    await client.join(userRoom(user.userId));

    this.metrics.recordConnection('connected');

    // Update the online users count gauge
    const onlineCount = await this.connectionService.getConnectedUsersCount();
    this.metrics.setOnlineUsersCount(onlineCount);

    client.emit(
      WS_EVENTS.SERVER.CONNECTION_ESTABLISHED,
      createWsEnvelope(
        WS_EVENTS.SERVER.CONNECTION_ESTABLISHED,
        { userId: user.userId, socketId: client.id },
        this.translate(client, WS_I18N.ROOM_JOINED),
        200,
      ),
    );
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    const userId = await this.connectionService.onDisconnect(client.id);
    if (userId) {
      const remaining = await this.connectionService.getUserSockets(userId);
      if (remaining.length === 0) {
        this.server
          .to(userRoom(userId))
          .emit(
            WS_EVENTS.SERVER.USER_OFFLINE,
            createWsEnvelope(WS_EVENTS.SERVER.USER_OFFLINE, { userId }),
          );
      }
    }

    this.metrics.recordDisconnection();
    const onlineCount = await this.connectionService.getConnectedUsersCount();
    this.metrics.setOnlineUsersCount(onlineCount);

    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage(WS_EVENTS.CLIENT.PING)
  async handlePing(
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<WsResponse<unknown>> {
    await this.connectionService.recordHeartbeat(client.id);
    this.metrics.recordHeartbeat();
    this.metrics.recordMessage(WS_EVENTS.CLIENT.PING);
    return { event: WS_EVENTS.SERVER.PONG, data: null };
  }

  @SubscribeMessage(WS_EVENTS.CLIENT.JOIN_ROOM)
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: RoomDto,
  ): Promise<WsResponse<unknown>> {
    const user = this.requireUser(client);
    this.metrics.recordMessage(WS_EVENTS.CLIENT.JOIN_ROOM);
    await client.join(dto.room);
    this.logger.debug(`User ${user.userId} joined room ${dto.room}`);

    return {
      event: WS_EVENTS.SERVER.ROOM_JOINED,
      data: {
        room: dto.room,
        message: this.translate(client, WS_I18N.ROOM_JOINED),
      },
    };
  }

  @SubscribeMessage(WS_EVENTS.CLIENT.LEAVE_ROOM)
  async handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: RoomDto,
  ): Promise<WsResponse<unknown>> {
    const user = this.requireUser(client);
    this.metrics.recordMessage(WS_EVENTS.CLIENT.LEAVE_ROOM);
    await client.leave(dto.room);
    this.logger.debug(`User ${user.userId} left room ${dto.room}`);

    return {
      event: WS_EVENTS.SERVER.ROOM_LEFT,
      data: {
        room: dto.room,
        message: this.translate(client, WS_I18N.ROOM_LEFT),
      },
    };
  }

  @SubscribeMessage(WS_EVENTS.CLIENT.SEND_ROOM_MESSAGE)
  async handleRoomMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: SendRoomMessageDto,
  ): Promise<void> {
    const user = this.requireUser(client);
    this.metrics.recordMessage(WS_EVENTS.CLIENT.SEND_ROOM_MESSAGE);

    client.to(dto.room).emit(
      WS_EVENTS.SERVER.ROOM_MESSAGE,
      createWsEnvelope(WS_EVENTS.SERVER.ROOM_MESSAGE, {
        room: dto.room,
        senderId: user.userId,
        senderEmail: user.email,
        message: dto.message,
        data: dto.data ?? null,
      }),
    );
  }

  @SubscribeMessage(WS_EVENTS.CLIENT.GET_PRESENCE)
  @WsPermissions(Permission.VIEW_USER)
  async handleGetPresence(
    @MessageBody() dto: GetPresenceDto,
  ): Promise<WsResponse<unknown>> {
    this.metrics.recordMessage(WS_EVENTS.CLIENT.GET_PRESENCE);
    const presence = await this.connectionService.getUserPresence(dto.userId);
    return {
      event: WS_EVENTS.SERVER.PRESENCE,
      data: {
        ...presence,
        lastSeenAt: presence.lastSeenAt?.toISOString() ?? null,
      },
    };
  }

  private async verify(
    token: string,
    socketId: string,
  ): Promise<ITokenPayload | null> {
    try {
      const user = await this.tokenProvider.verifyAccessToken(token);
      if (!user) {
        this.logger.warn(`Rejected invalid token on socket: ${socketId}`);
      }
      return user;
    } catch (error) {
      this.logger.warn(
        `Rejected token that failed verification on socket: ${socketId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private requireUser(client: AuthenticatedSocket): ITokenPayload {
    const user = client.data?.user;
    if (!user) {
      this.logger.error(`Missing authenticated user on socket: ${client.id}`);
      throw wsError(
        'UNAUTHORIZED',
        this.translate(client, WS_I18N.UNAUTHORIZED),
        401,
      );
    }
    return user;
  }

  private translate(client: AuthenticatedSocket, key: WsI18nKey): string {
    return this.i18n.t(key, {
      lang: client.data?.lang ?? WS_DEFAULT_LANG,
    }) as string;
  }
}
