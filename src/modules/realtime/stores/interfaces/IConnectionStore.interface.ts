export interface IConnectionStore {
  addSocket(userId: string, socketId: string): Promise<void>;
  removeSocket(socketId: string): Promise<string | null>;
  getUserSockets(userId: string): Promise<string[]>;
  getUserIdBySocketId(socketId: string): Promise<string | null>;
  isUserOnline(userId: string): Promise<boolean>;
  touchHeartbeat(socketId: string): Promise<void>;
  findInactiveSockets(staleThresholdMs: number): Promise<string[]>;
  getAllConnectedUsersCount(): Promise<number>;
  getUserLastSeen(userId: string): Promise<number | null>;
}

export const REALTIME_CONNECTION_STORE = 'REALTIME_CONNECTION_STORE';
