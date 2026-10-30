import { Injectable, Optional } from '@nestjs/common';
import { NotificationService } from '../../notification/notification.service.js';
import { INotificationAdapter } from '../interfaces/IAuth.interface.js';

@Injectable()
export class NotificationAdapter implements INotificationAdapter {
  constructor(
    @Optional() private readonly notificationService?: NotificationService,
  ) {}

  async sendEmail(to: string, subject: string, body: string, context: Record<string, unknown>): Promise<void> {
    if (!this.notificationService) {
      return;
    }

    await this.notificationService.sendEmail({
      to,
      subject,
      body,
      context,
    });
  }
}

export const NOTIFICATION_ADAPTER = 'NOTIFICATION_ADAPTER';