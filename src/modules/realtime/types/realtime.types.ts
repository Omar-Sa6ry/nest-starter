import type { Socket } from 'socket.io';
import type { ITokenPayload } from '../../../common/interfaces/ISecurity.interface.js';
import type { WsLang } from '../constants/realtime.constants.js';

export interface IWsClientData {
  user?: ITokenPayload;
  lang?: WsLang;
}

export interface IAuthenticatedSocket extends Socket {
  data: IWsClientData;
}

export type WsHandshake = Socket['handshake'];

export interface IWsEnvelope<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  timestamp: string;
  event: string;
  data: T;
}

export interface IUserPresenceStatus {
  userId: string;
  isOnline: boolean;
  connectionsCount: number;
  lastSeenAt: Date | null;
}

export interface IWsExceptionPayload {
  success: false;
  statusCode: number;
  message: string;
  timestamp: string;
  code: string;
  details?: Record<string, string[]>;
}

// Backward-compatible type aliases
export type WsClientData = IWsClientData;
export type AuthenticatedSocket = IAuthenticatedSocket;
export type WsEnvelope<T = unknown> = IWsEnvelope<T>;
export type UserPresenceStatus = IUserPresenceStatus;
export type WsExceptionPayload = IWsExceptionPayload;
