import { Injectable } from '@nestjs/common';
import {
  IdGenerator,
  ChannelType,
  NotificationMessage,
  NotificationPriority,
  NotificationCategory,
} from '@bts-soft/core';

export interface CreateMessageOptions {
  recipientId: string;
  body: string;
  subject?: string;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  templateName?: string;
  context?: Record<string, unknown>;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationMessageFactory {
  createMessage(options: CreateMessageOptions): NotificationMessage {
    const id = IdGenerator.generate('snowflake');

    return {
      recipientId: options.recipientId.trim(),
      body: options.body,
      subject: options.subject,
      priority: options.priority ?? NotificationPriority.NORMAL,
      category: options.category ?? NotificationCategory.TRANSACTIONAL,
      context: options.context,
      idempotencyKey: options.idempotencyKey || id,
      channelOptions: {
        ...options.metadata,
        snowflakeId: id,
        createdAt: new Date().toISOString(),
        ...(options.templateName ? { templateName: options.templateName } : {}),
      },
    };
  }

  createEmailMessage(
    to: string,
    subject: string,
    body: string,
    templateName?: string,
    context?: Record<string, unknown>,
  ): { channel: ChannelType; message: NotificationMessage } {
    return {
      channel: ChannelType.EMAIL,
      message: this.createMessage({
        recipientId: to,
        subject,
        body,
        templateName,
        context,
        priority: NotificationPriority.NORMAL,
        category: NotificationCategory.TRANSACTIONAL,
      }),
    };
  }
}
