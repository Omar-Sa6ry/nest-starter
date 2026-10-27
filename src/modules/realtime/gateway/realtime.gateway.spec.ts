import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
  type MockInstance,
} from 'vitest';
import { Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import { RealtimeGateway } from './realtime.gateway.js';
import type {
  ITokenPayload,
  ITokenProvider,
} from '../../../common/interfaces/ISecurity.interface.js';
import type { ConnectionService } from '../services/connection.service.js';
import type { HeartbeatService } from '../services/heartbeat.service.js';
import type { RealtimeMetricsService } from '../services/realtime-metrics.service.js';
import type { I18nTranslate } from '../types/i18n.types.js';
import type { AuthenticatedSocket } from '../types/realtime.types.js';
import { WS_I18N } from '../constants/realtime-i18n.constants.js';
import type { TranslateOptions } from 'nestjs-i18n';
import type {
  RoomDto,
  SendRoomMessageDto,
  GetPresenceDto,
} from '../dtos/ws-client-message.dto.js';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let tokenProvider: ITokenProvider;
  let connectionServiceMock: {
    onConnect: Mock<(userId: string, socketId: string) => Promise<void>>;
    onDisconnect: Mock<(socketId: string) => Promise<string | null>>;
    getUserSockets: Mock<(userId: string) => Promise<string[]>>;
    getUserPresence: Mock<(userId: string) => Promise<UserPresenceFixture>>;
    recordHeartbeat: Mock<(socketId: string) => Promise<void>>;
    getConnectedUsersCount: Mock<() => Promise<number>>;
  };
  let heartbeatServiceMock: { bindServer: Mock<(server: Server) => void> };
  let metricsMock: {
    recordConnection: Mock;
    recordDisconnection: Mock;
    recordMessage: Mock;
    recordHeartbeat: Mock;
    recordError: Mock;
    recordReapedConnections: Mock;
    setOnlineUsersCount: Mock;
  };
  let translate: Mock<(key: string, options?: TranslateOptions) => string>;
  let logSpy: MockInstance;
  let warnSpy: MockInstance;
  let errorSpy: MockInstance;
  let debugSpy: MockInstance;

  interface UserPresenceFixture {
    userId: string;
    isOnline: boolean;
    connectionsCount: number;
    lastSeenAt: Date | null;
  }

  const user: ITokenPayload = {
    userId: 'user-1',
    email: 'user@example.com',
    role: 'user',
    permissions: [],
  };

  interface SocketFixture {
    socket: AuthenticatedSocket;
    emit: Mock;
    join: Mock;
    leave: Mock;
    disconnect: Mock;
    to: Mock;
    roomEmit: Mock;
  }

  function createSocket(
    handshake: {
      headers?: Record<string, string>;
      auth?: Record<string, unknown>;
      query?: Record<string, unknown>;
    } = {},
    data: AuthenticatedSocket['data'] = {},
  ): SocketFixture {
    const emit = vi.fn();
    const join = vi.fn().mockResolvedValue(undefined);
    const leave = vi.fn().mockResolvedValue(undefined);
    const disconnect = vi.fn();
    const roomEmit = vi.fn();
    const to = vi.fn(() => ({ emit: roomEmit }));
    const socket = {
      id: 'socket-1',
      data,
      handshake: {
        headers: handshake.headers ?? {},
        auth: handshake.auth ?? {},
        query: handshake.query ?? {},
        address: '127.0.0.1',
      },
      emit,
      join,
      leave,
      disconnect,
      to,
    } as unknown as AuthenticatedSocket;
    return { socket, emit, join, leave, disconnect, to, roomEmit };
  }

  beforeEach(() => {
    logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    debugSpy = vi
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);

    tokenProvider = {
      generateTokens: vi.fn(),
      verifyAccessToken: vi.fn().mockResolvedValue(user),
      verifyRefreshToken: vi.fn(),
      getJti: vi.fn(),
    };
    connectionServiceMock = {
      onConnect: vi.fn().mockResolvedValue(undefined),
      onDisconnect: vi.fn().mockResolvedValue(null),
      getUserSockets: vi.fn().mockResolvedValue([]),
      getUserPresence: vi.fn().mockResolvedValue({
        userId: 'user-1',
        isOnline: true,
        connectionsCount: 1,
        lastSeenAt: null,
      }),
      recordHeartbeat: vi.fn().mockResolvedValue(undefined),
      getConnectedUsersCount: vi.fn().mockResolvedValue(1),
    };
    heartbeatServiceMock = {
      bindServer: vi.fn(),
    };
    metricsMock = {
      recordConnection: vi.fn(),
      recordDisconnection: vi.fn(),
      recordMessage: vi.fn(),
      recordHeartbeat: vi.fn(),
      recordError: vi.fn(),
      recordReapedConnections: vi.fn(),
      setOnlineUsersCount: vi.fn(),
    };
    translate = vi.fn(
      (key: string, _options?: TranslateOptions) => `tx:${key}`,
    );
    const i18n = { t: translate } as unknown as I18nTranslate;

    gateway = new RealtimeGateway(
      tokenProvider,
      connectionServiceMock as unknown as ConnectionService,
      heartbeatServiceMock as unknown as HeartbeatService,
      metricsMock as unknown as RealtimeMetricsService,
      i18n,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('afterInit', () => {
    it('binds the server to the heartbeat watchdog and logs', () => {
      const server = { id: 'server-1' } as unknown as Server;

      gateway.afterInit(server);

      expect(heartbeatServiceMock.bindServer).toHaveBeenCalledWith(server);
      expect(logSpy).toHaveBeenCalledWith(
        'Realtime gateway listening on /realtime',
      );
    });
  });

  describe('handleConnection', () => {
    it('rejects a socket with no token without invoking the token provider', async () => {
      const { socket, disconnect } = createSocket();

      await gateway.handleConnection(socket);

      expect(disconnect).toHaveBeenCalledWith(true);
      expect(tokenProvider.verifyAccessToken).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(metricsMock.recordConnection).toHaveBeenCalledWith(
        'rejected_no_token',
      );
    });

    it('verifies the bearer token from the Authorization header', async () => {
      const { socket } = createSocket({
        headers: { authorization: 'Bearer header-tok' },
      });

      await gateway.handleConnection(socket);

      expect(tokenProvider.verifyAccessToken).toHaveBeenCalledWith(
        'header-tok',
      );
    });

    it('verifies the token carried by the socket.io auth payload', async () => {
      const { socket } = createSocket({ auth: { token: 'auth-tok' } });

      await gateway.handleConnection(socket);

      expect(tokenProvider.verifyAccessToken).toHaveBeenCalledWith('auth-tok');
    });

    it('verifies the token carried by the query string', async () => {
      const { socket } = createSocket({ query: { token: 'query-tok' } });

      await gateway.handleConnection(socket);

      expect(tokenProvider.verifyAccessToken).toHaveBeenCalledWith('query-tok');
    });

    it('disconnects when verification returns no user', async () => {
      vi.mocked(tokenProvider.verifyAccessToken).mockResolvedValue(null);
      const { socket, disconnect } = createSocket({
        headers: { authorization: 'Bearer bad-tok' },
      });

      await gateway.handleConnection(socket);

      expect(disconnect).toHaveBeenCalledWith(true);
      expect(socket.data.user).toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
      expect(metricsMock.recordConnection).toHaveBeenCalledWith(
        'rejected_invalid_token',
      );
    });

    it('treats a rejected verification as an invalid token instead of crashing', async () => {
      vi.mocked(tokenProvider.verifyAccessToken).mockRejectedValueOnce(
        new Error('signature backend down'),
      );
      const { socket, disconnect } = createSocket({
        headers: { authorization: 'Bearer failing-tok' },
      });

      await expect(gateway.handleConnection(socket)).resolves.toBeUndefined();

      expect(disconnect).toHaveBeenCalledWith(true);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('signature backend down'),
      );
    });

    it('stringifies a non-Error rejection reason', async () => {
      vi.mocked(tokenProvider.verifyAccessToken).mockRejectedValueOnce(
        'raw rejection',
      );
      const { socket, disconnect } = createSocket({
        headers: { authorization: 'Bearer failing-tok' },
      });

      await expect(gateway.handleConnection(socket)).resolves.toBeUndefined();

      expect(disconnect).toHaveBeenCalledWith(true);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('raw rejection'),
      );
    });

    it('freezes user and lang, registers presence, records metrics, and greets the client', async () => {
      const { socket, emit, join } = createSocket({
        headers: { authorization: 'Bearer good-tok' },
        query: { lang: 'ar' },
      });

      await gateway.handleConnection(socket);

      expect(socket.data.user).toEqual(user);
      expect(socket.data.lang).toBe('ar');
      expect(connectionServiceMock.onConnect).toHaveBeenCalledWith(
        'user-1',
        'socket-1',
      );
      expect(join).toHaveBeenCalledWith('user:user-1');
      expect(metricsMock.recordConnection).toHaveBeenCalledWith('connected');
      expect(metricsMock.setOnlineUsersCount).toHaveBeenCalledWith(1);
      // Envelope must follow the application-wide shape
      expect(emit).toHaveBeenCalledWith(
        'connection_established',
        expect.objectContaining({
          success: true,
          statusCode: 200,
          event: 'connection_established',
          data: { userId: 'user-1', socketId: 'socket-1' },
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        }),
      );
    });

    it('defaults the frozen language to English', async () => {
      const { socket } = createSocket({
        headers: { authorization: 'Bearer good-tok' },
      });

      await gateway.handleConnection(socket);

      expect(socket.data.lang).toBe('en');
    });
  });

  describe('handleDisconnect', () => {
    function attachServer(): { server: Server; roomEmit: Mock } {
      const roomEmit = vi.fn();
      const server = {
        to: vi.fn(() => ({ emit: roomEmit })),
      } as unknown as Server;
      gateway.server = server;
      return { server, roomEmit };
    }

    it('announces the user offline when the last socket goes away', async () => {
      const { roomEmit } = attachServer();
      vi.mocked(connectionServiceMock.onDisconnect).mockResolvedValue('user-1');
      vi.mocked(connectionServiceMock.getUserSockets).mockResolvedValue([]);
      const { socket } = createSocket();

      await gateway.handleDisconnect(socket);

      expect(roomEmit).toHaveBeenCalledWith(
        'user_offline',
        expect.objectContaining({
          success: true,
          statusCode: 200,
          event: 'user_offline',
          data: { userId: 'user-1' },
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        }),
      );
      expect(debugSpy).toHaveBeenCalledWith('Socket disconnected: socket-1');
      expect(metricsMock.recordDisconnection).toHaveBeenCalled();
    });

    it('stays silent while the user still owns other sockets', async () => {
      const { server, roomEmit } = attachServer();
      vi.mocked(connectionServiceMock.onDisconnect).mockResolvedValue('user-1');
      vi.mocked(connectionServiceMock.getUserSockets).mockResolvedValue([
        'socket-2',
      ]);
      const { socket } = createSocket();

      await gateway.handleDisconnect(socket);

      expect(server.to).not.toHaveBeenCalled();
      expect(roomEmit).not.toHaveBeenCalled();
    });

    it('skips the offline lookup when the socket was never registered', async () => {
      const { server } = attachServer();
      vi.mocked(connectionServiceMock.onDisconnect).mockResolvedValue(null);
      const { socket } = createSocket();

      await gateway.handleDisconnect(socket);

      expect(connectionServiceMock.getUserSockets).not.toHaveBeenCalled();
      expect(server.to).not.toHaveBeenCalled();
    });
  });

  describe('handlePing', () => {
    it('records the heartbeat, increments metrics, and answers with a pong ack', async () => {
      const { socket } = createSocket();

      const result = await gateway.handlePing(socket);

      expect(connectionServiceMock.recordHeartbeat).toHaveBeenCalledWith(
        'socket-1',
      );
      expect(metricsMock.recordHeartbeat).toHaveBeenCalled();
      expect(metricsMock.recordMessage).toHaveBeenCalledWith('ping');
      expect(result).toEqual({ event: 'pong', data: null });
    });
  });

  describe('handleJoinRoom', () => {
    it('joins the room and returns a localized confirmation', async () => {
      const { socket, join } = createSocket({}, { user, lang: 'ar' });

      const result = await gateway.handleJoinRoom(socket, {
        room: 'lobby',
      } as RoomDto);

      expect(join).toHaveBeenCalledWith('lobby');
      expect(metricsMock.recordMessage).toHaveBeenCalledWith('join_room');
      expect(result).toEqual({
        event: 'room_joined',
        data: { room: 'lobby', message: 'tx:realtime.ROOM_JOINED' },
      });
      expect(translate).toHaveBeenCalledWith(WS_I18N.ROOM_JOINED, {
        lang: 'ar',
      });
    });

    it('rejects an unauthenticated socket with a localized UNAUTHORIZED', async () => {
      const { socket, join } = createSocket({}, { lang: 'en' });

      let thrown: unknown;
      try {
        await gateway.handleJoinRoom(socket, { room: 'lobby' } as RoomDto);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(WsException);
      const payload = (thrown as WsException).getError() as Record<
        string,
        unknown
      >;
      expect(payload.code).toBe('UNAUTHORIZED');
      expect(payload.message).toBe('tx:realtime.UNAUTHORIZED');
      expect(payload.statusCode).toBe(401);
      expect(payload.success).toBe(false);
      expect(join).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('handleLeaveRoom', () => {
    it('leaves the room and returns a localized confirmation', async () => {
      const { socket, leave } = createSocket({}, { user, lang: 'en' });

      const result = await gateway.handleLeaveRoom(socket, {
        room: 'lobby',
      } as RoomDto);

      expect(leave).toHaveBeenCalledWith('lobby');
      expect(metricsMock.recordMessage).toHaveBeenCalledWith('leave_room');
      expect(result).toEqual({
        event: 'room_left',
        data: { room: 'lobby', message: 'tx:realtime.ROOM_LEFT' },
      });
      expect(translate).toHaveBeenCalledWith(WS_I18N.ROOM_LEFT, { lang: 'en' });
    });

    it('rejects an unauthenticated socket', async () => {
      const { socket, leave } = createSocket({}, {});

      await expect(
        gateway.handleLeaveRoom(socket, { room: 'lobby' } as RoomDto),
      ).rejects.toThrow(WsException);
      expect(leave).not.toHaveBeenCalled();
    });
  });

  describe('handleRoomMessage', () => {
    it('broadcasts the envelope to the other room members', async () => {
      const { socket, to, roomEmit } = createSocket({}, { user });
      const dto = {
        room: 'lobby',
        message: 'hello',
        data: { attachment: 'a.png' },
      } as SendRoomMessageDto;

      const result = await gateway.handleRoomMessage(socket, dto);

      expect(result).toBeUndefined();
      expect(to).toHaveBeenCalledWith('lobby');
      expect(metricsMock.recordMessage).toHaveBeenCalledWith(
        'send_room_message',
      );
      expect(roomEmit).toHaveBeenCalledWith(
        'room_message',
        expect.objectContaining({
          success: true,
          statusCode: 200,
          event: 'room_message',
          data: {
            room: 'lobby',
            senderId: 'user-1',
            senderEmail: 'user@example.com',
            message: 'hello',
            data: { attachment: 'a.png' },
          },
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        }),
      );
    });

    it('nullifies the optional data payload when the dto omits it', async () => {
      const { socket, roomEmit } = createSocket({}, { user });
      const dto = { room: 'lobby', message: 'hello' } as SendRoomMessageDto;

      await gateway.handleRoomMessage(socket, dto);

      expect(roomEmit).toHaveBeenCalledWith(
        'room_message',
        expect.objectContaining({
          data: expect.objectContaining({ data: null }),
        }),
      );
    });

    it('rejects an unauthenticated socket', async () => {
      const { socket, to } = createSocket({}, {});
      const dto = { room: 'lobby', message: 'hello' } as SendRoomMessageDto;

      await expect(gateway.handleRoomMessage(socket, dto)).rejects.toThrow(
        WsException,
      );
      expect(to).not.toHaveBeenCalled();
    });
  });

  describe('handleGetPresence', () => {
    it('serializes a Date lastSeenAt to an ISO string', async () => {
      const lastSeenAt = new Date('2026-01-02T03:04:05.000Z');
      vi.mocked(connectionServiceMock.getUserPresence).mockResolvedValue({
        userId: 'user-2',
        isOnline: true,
        connectionsCount: 2,
        lastSeenAt,
      });

      const result = await gateway.handleGetPresence({
        userId: 'user-2',
      } as GetPresenceDto);

      expect(connectionServiceMock.getUserPresence).toHaveBeenCalledWith(
        'user-2',
      );
      expect(metricsMock.recordMessage).toHaveBeenCalledWith('get_presence');
      expect(result).toEqual({
        event: 'presence',
        data: {
          userId: 'user-2',
          isOnline: true,
          connectionsCount: 2,
          lastSeenAt: '2026-01-02T03:04:05.000Z',
        },
      });
    });

    it('answers null lastSeenAt for a user without any heartbeat', async () => {
      const result = await gateway.handleGetPresence({
        userId: 'user-2',
      } as GetPresenceDto);

      expect(result).toEqual({
        event: 'presence',
        data: {
          userId: 'user-1',
          isOnline: true,
          connectionsCount: 1,
          lastSeenAt: null,
        },
      });
    });
  });
});
