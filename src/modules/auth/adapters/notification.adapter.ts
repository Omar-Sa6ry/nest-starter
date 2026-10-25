import { Injectable, Inject, Optional } from '@nestjs/common';
import { NotificationService, ChannelType } from '@bts-soft/core';
import { INotificationAdapter } from '../interfaces/IAuth.interface.js';

@Injectable()
export class NotificationAdapter implements INotificationAdapter {
  constructor(
    @Optional() @Inject('NOTIFICATION_SERVICE') private readonly notificationService?: NotificationService,
  ) {}

  async sendEmail(to: string, subject: string, body: string, context: Record<string, unknown>): Promise<void> {
    if (!this.notificationService) {
      return;
    }

    await this.notificationService.send(ChannelType.EMAIL, {
      recipientId: to,
      subject,
      body,
      context,
    });
  }
}

export const NOTIFICATION_ADAPTER = 'NOTIFICATION_ADAPTER';