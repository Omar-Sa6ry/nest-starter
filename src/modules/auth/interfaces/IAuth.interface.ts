export interface SessionData {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  createdAt: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  sessionId: string;
}

export interface ITokenProvider {
  generateTokens(payload: TokenPayload): Promise<TokenPair>;
  verifyAccessToken(token: string): Promise<TokenPayload | null>;
  verifyRefreshToken(token: string): Promise<TokenPayload | null>;
  getJti(token: string): Promise<string | null>;
}

export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export interface ISessionStore {
  createSession(userId: string, sessionId: string, data: SessionData, ttl: number): Promise<void>;
  getSession(userId: string, sessionId: string): Promise<SessionData | null>;
  revokeSession(userId: string, sessionId: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;
  storeRefreshToken(tokenHash: string, userId: string, ttl: number): Promise<void>;
  getUserIdByRefreshToken(tokenHash: string): Promise<string | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  blacklistToken(jti: string, ttl: number): Promise<void>;
}

export interface IRedisAdapter {
  set(key: string, value: unknown, ttl: number): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  del(key: string): Promise<void>;
}

export interface INotificationAdapter {
  sendEmail(to: string, subject: string, body: string, context: Record<string, unknown>): Promise<void>;
}