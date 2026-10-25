export interface IPasswordHasher {
  hash(plainText: string): Promise<string>;
  compare(plainText: string, hash: string): Promise<boolean>;
}

export interface ITokenPayload {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  sessionId?: string;
}

export interface ITokenResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ITokenProvider {
  generateTokens(payload: ITokenPayload): Promise<ITokenResult>;
  verifyAccessToken(token: string): Promise<ITokenPayload | null>;
  verifyRefreshToken(token: string): Promise<ITokenPayload | null>;
  getJti(token: string): Promise<string | null>;
}

export interface IUserSessionData {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  createdAt: Date;
}

export interface ISessionStore {
  createSession(
    userId: string,
    sessionId: string,
    data: IUserSessionData,
    ttlSeconds: number,
  ): Promise<void>;
  getSession(
    userId: string,
    sessionId: string,
  ): Promise<IUserSessionData | null>;
  revokeSession(userId: string, sessionId: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;
  blacklistToken(jti: string, ttlSeconds: number): Promise<void>;
  isTokenBlacklisted(jti: string): Promise<boolean>;
  storeRefreshToken(
    refreshTokenHash: string,
    userId: string,
    ttlSeconds: number,
  ): Promise<void>;
  getUserIdByRefreshToken(refreshTokenHash: string): Promise<string | null>;
  revokeRefreshToken(refreshTokenHash: string): Promise<void>;
}
