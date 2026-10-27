export const WS_EVENTS = {
  CLIENT: {
    PING: 'ping',
    JOIN_ROOM: 'join_room',
    LEAVE_ROOM: 'leave_room',
    SEND_ROOM_MESSAGE: 'send_room_message',
    GET_PRESENCE: 'get_presence',
  },
  SERVER: {
    CONNECTION_ESTABLISHED: 'connection_established',
    PONG: 'pong',
    ROOM_JOINED: 'room_joined',
    ROOM_LEFT: 'room_left',
    ROOM_MESSAGE: 'room_message',
    USER_OFFLINE: 'user_offline',
    PRESENCE: 'presence',
    EXCEPTION: 'exception',
  },
} as const;

export const WS_REALTIME_PATH = '/realtime';

export const WS_LANGS = ['en', 'ar'] as const;
export type WsLang = (typeof WS_LANGS)[number];
export const WS_DEFAULT_LANG = 'en';

export const USER_ROOM_PREFIX = 'user:';

export const userRoom = (userId: string): string =>
  `${USER_ROOM_PREFIX}${userId}`;


export const HEARTBEAT = {
  STALE_MS: 60_000,
  SWEEP_INTERVAL_MS: 30_000,
  REDIS_TTL_SECONDS: 24 * 60 * 60,
  /** ZSET of socketId -> last heartbeat epoch (ms), used by the watchdog. */
  NAME: 'rt:hb',
} as const;


export const RATE_LIMIT = {
  DEFAULT_MAX: 30,
  DEFAULT_WINDOW_MS: 10_000,
} as const;

export const RT_REDIS_KEYS = {
  socketUser: (socketId: string): string => `rt:sock:${socketId}`,
  userSockets: (userId: string): string => `rt:user:${userId}:sockets`,
  ONLINE_USERS: 'rt:online:users',
} as const;

export const REALTIME_ENV = {
  STORE: 'REALTIME_STORE', // 'memory' | 'redis'
  CLUSTER: 'REALTIME_CLUSTER', // 'true' | 'false' — socket.io Redis adapter
  HEARTBEAT_STALE_MS: 'REALTIME_HEARTBEAT_STALE_MS',
  HEARTBEAT_SWEEP_MS: 'REALTIME_HEARTBEAT_SWEEP_MS',
  RATE_LIMIT_MAX: 'REALTIME_RATE_LIMIT_MAX',
  RATE_LIMIT_WINDOW_MS: 'REALTIME_RATE_LIMIT_WINDOW_MS',
} as const;
