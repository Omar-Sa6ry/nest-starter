/**
 * Auth-module-specific adapter contracts.
 *
 * Shared security contracts (ITokenProvider, IPasswordHasher, ISessionStore,
 * ITokenPayload, IUserSessionData, ITokenResult) live in
 * `src/common/interfaces/ISecurity.interface.ts` — single source of truth
 * consumed by both `common` implementations and every auth command.
 */
export interface IRedisAdapter {
  set(key: string, value: unknown, ttl: number): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  del(key: string): Promise<void>;
}

export interface INotificationAdapter {
  sendEmail(to: string, subject: string, body: string, context: Record<string, unknown>): Promise<void>;
}
