import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module.js';
import { TOKEN_PROVIDER } from '../src/common/security/tokens/injection.tokens.js';
import type { ITokenPayload } from '../src/common/interfaces/ISecurity.interface.js';
import { Permission, Role } from '../src/common/constant/enum.constant.js';

describe('Realtime Socket.IO (e2e)', () => {
  let app: INestApplication;
  let url: string;
  const clients: Socket[] = [];
  const user: ITokenPayload = {
    userId: 'realtime-e2e-user',
    email: 'realtime@example.com',
    role: Role.ADMIN,
    permissions: [Permission.VIEW_USER],
  };
  const limitedUser: ITokenPayload = {
    userId: 'realtime-limited-user',
    email: 'limited@example.com',
    role: Role.USER,
    permissions: [],
  };

  function connect(token = 'valid-e2e-token'): Socket {
    const socket = io(url, {
      path: '/realtime',
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
      timeout: 5_000,
    });
    clients.push(socket);
    return socket;
  }

  function once<T>(socket: Socket, event: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 5_000);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  beforeAll(async () => {
    process.env.REALTIME_STORE = 'memory';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TOKEN_PROVIDER)
      .useValue({
        verifyAccessToken: vi.fn(async (token: string) => {
          if (token === 'valid-e2e-token') return user;
          if (token === 'limited-e2e-token') return limitedUser;
          return null;
        }),
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') throw new Error('Test HTTP server has no TCP address');
    url = `http://127.0.0.1:${address.port}`;
  }, 180_000);

  afterEach(() => {
    for (const socket of clients.splice(0)) socket.disconnect();
  });

  afterAll(async () => {
    await app?.close();
    delete process.env.REALTIME_STORE;
  });

  it('authenticates the handshake and returns the standard success envelope', async () => {
    const socket = connect();
    const established = await once<Record<string, unknown>>(socket, 'connection_established');
    expect(established).toEqual(expect.objectContaining({
      success: true,
      statusCode: 200,
      message: expect.any(String),
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      event: 'connection_established',
      data: { userId: user.userId, socketId: expect.any(String) },
    }));
  });

  it('answers ping with pong and the common realtime envelope', async () => {
    const socket = connect();
    await once(socket, 'connection_established');
    const pong = once<Record<string, unknown>>(socket, 'pong');
    socket.emit('ping');
    expect(await pong).toEqual(expect.objectContaining({
      success: true,
      statusCode: 200,
      timestamp: expect.any(String),
      event: 'pong',
      data: null,
    }));
  });

  it('joins a room and delivers room messages to other room members only', async () => {
    const sender = connect();
    const receiver = connect();
    await Promise.all([
      once(sender, 'connection_established'),
      once(receiver, 'connection_established'),
    ]);
    const joined = once<Record<string, unknown>>(receiver, 'room_joined');
    receiver.emit('join_room', { room: 'e2e-room' });
    expect(await joined).toEqual(expect.objectContaining({
      success: true,
      statusCode: 200,
      event: 'room_joined',
      data: expect.objectContaining({ room: 'e2e-room' }),
    }));

    const received = once<Record<string, unknown>>(receiver, 'room_message');
    sender.emit('send_room_message', { room: 'e2e-room', message: 'hello realtime' });
    expect(await received).toEqual(expect.objectContaining({
      success: true,
      statusCode: 200,
      event: 'room_message',
      data: expect.objectContaining({
        room: 'e2e-room',
        senderId: user.userId,
        message: 'hello realtime',
      }),
    }));
  });

  it('returns an online presence snapshot for an authenticated user with VIEW_USER permission', async () => {
    const socket = connect();
    await once(socket, 'connection_established');
    const presence = once<Record<string, unknown>>(socket, 'presence');
    socket.emit('get_presence', { userId: user.userId });
    expect(await presence).toEqual(expect.objectContaining({
      success: true,
      statusCode: 200,
      event: 'presence',
      data: expect.objectContaining({
        userId: user.userId,
        isOnline: true,
        connectionsCount: expect.any(Number),
      }),
    }));
  });

  it('rejects get_presence when user lacks VIEW_USER permission', async () => {
    const socket = connect('limited-e2e-token');
    await once(socket, 'connection_established');
    const exception = once<Record<string, unknown>>(socket, 'exception');
    socket.emit('get_presence', { userId: user.userId });
    expect(await exception).toEqual(expect.objectContaining({
      success: false,
      statusCode: 403,
      event: 'exception',
      data: expect.objectContaining({
        code: 'FORBIDDEN',
        statusCode: 403,
      }),
    }));
  });

  it('rejects a connection with an invalid access token', async () => {
    const socket = connect('invalid-e2e-token');
    await once(socket, 'disconnect');
    expect(socket.connected).toBe(false);
  });
});
