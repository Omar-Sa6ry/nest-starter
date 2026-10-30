import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserRegisteredEvent } from '../../../auth/events/domain.events.js';
import { NotificationService } from '../../notification.service.js';

@Injectable()
export class NotificationDomainListener {
  private readonly logger = new Logger(NotificationDomainListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent('user.registered')
  async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    this.logger.log(
      `Triggering welcome notification for user: ${event.email} (${event.userId})`,
    );

    try {
      await this.notificationService.sendEmail({
        to: event.email,
        subject: `Welcome to our platform, ${event.firstName || 'User'}!`,
        body: `Hello ${event.firstName || 'there'},\n\nYour account has been successfully created. Welcome aboard!`,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to dispatch welcome email to ${event.email}: ${msg}`,
      );
    }
  }
}
