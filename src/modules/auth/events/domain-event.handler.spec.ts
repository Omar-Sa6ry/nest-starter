import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DomainEventHandler } from './domain-event.handler.js';
import { StructuredLogger } from '../../../common/logging/logger.service.js';
import { Role } from '../../../common/constant/enum.constant.js';

describe('DomainEventHandler', () => {
  let handler: DomainEventHandler;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    handler = new DomainEventHandler();
    logSpy = vi
      .spyOn(StructuredLogger.prototype, 'log')
      .mockImplementation(() => undefined);
  });

  it('logs user.registered events', () => {
    handler.handleUserRegistered({
      userId: 'user-1',
      email: 'test@example.com',
      firstName: 'Test',
      role: Role.USER,
    } as never);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('test@example.com'),
      'DomainEventHandler',
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('user-1'),
      'DomainEventHandler',
    );
  });

  it('logs user.logged_in events', () => {
    handler.handleUserLoggedIn({
      userId: 'user-1',
      email: 'test@example.com',
    } as never);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('User logged in'),
      'DomainEventHandler',
    );
  });

  it('logs user.logged_out events', () => {
    handler.handleUserLoggedOut({
      userId: 'user-1',
      sessionId: 'session-1',
    } as never);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('session-1'),
      'DomainEventHandler',
    );
  });

  it('logs password.reset_requested events', () => {
    handler.handlePasswordResetRequested({
      userId: 'user-1',
      email: 'test@example.com',
    } as never);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Password reset requested'),
      'DomainEventHandler',
    );
  });

  it('logs password.reset_completed events', () => {
    handler.handlePasswordResetCompleted({
      userId: 'user-1',
    } as never);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Password reset completed'),
      'DomainEventHandler',
    );
  });
});
