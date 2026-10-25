import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  UserRegisteredEvent,
  UserLoggedInEvent,
  UserLoggedOutEvent,
  PasswordResetRequestedEvent,
  PasswordResetCompletedEvent,
} from './domain.events.js';
import { StructuredLogger } from '../../../common/logging/logger.service.js';

@Injectable()
export class DomainEventHandler {
  private readonly logger = new StructuredLogger();

  @OnEvent('user.registered')
  handleUserRegistered(event: UserRegisteredEvent): void {
    this.logger.log(
      `User registered: ${event.email} (${event.userId}) role=${event.role}`,
      'DomainEventHandler',
    );
  }

  @OnEvent('user.logged_in')
  handleUserLoggedIn(event: UserLoggedInEvent): void {
    this.logger.log(
      `User logged in: ${event.email} (${event.userId})`,
      'DomainEventHandler',
    );
  }

  @OnEvent('user.logged_out')
  handleUserLoggedOut(event: UserLoggedOutEvent): void {
    this.logger.log(
      `User logged out: ${event.userId} session=${event.sessionId}`,
      'DomainEventHandler',
    );
  }

  @OnEvent('password.reset_requested')
  handlePasswordResetRequested(event: PasswordResetRequestedEvent): void {
    this.logger.log(
      `Password reset requested for: ${event.email} (${event.userId})`,
      'DomainEventHandler',
    );
  }

  @OnEvent('password.reset_completed')
  handlePasswordResetCompleted(event: PasswordResetCompletedEvent): void {
    this.logger.log(
      `Password reset completed for user: ${event.userId}`,
      'DomainEventHandler',
    );
  }
}
