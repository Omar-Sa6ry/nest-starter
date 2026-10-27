import type { Socket } from 'socket.io';
import type { ITokenPayload } from '../../../common/interfaces/ISecurity.interface.js';
import type { WsLang } from '../constants/realtime.constants.js';

export interface WsClientData {
  user?: ITokenPayload;
  lang?: WsLang;
}

export interface AuthenticatedSocket extends Socket {
  data: WsClientData;
}

export type WsHandshake = Socket['handshake'];

export interface WsEnvelope<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  timestamp: string;
  event: string;
  data: T;
}

export interface UserPresenceStatus {
  userId: string;
  isOnline: boolean;
  connectionsCount: number;
  lastSeenAt: Date | null;
}

export interface WsExceptionPayload {
  success: false;
  statusCode: number;
  message: string;
  timestamp: string;
  code: string;
  details?: Record<string, string[]>;
}
