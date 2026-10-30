import { describe, it, expect } from 'vitest';
import { NotificationMessageFactory } from './notification-message.factory.js';
import {
  ChannelType,
  NotificationPriority,
  NotificationCategory,
} from '@bts-soft/core';

describe('NotificationMessageFactory', () => {
  const factory = new NotificationMessageFactory();

  it('should create a notification message with snowflake id and defaults', () => {
    const msg = factory.createMessage({
      recipientId: 'user@example.com',
      body: 'Hello world',
    });

    expect(msg.recipientId).toBe('user@example.com');
    expect(msg.body).toBe('Hello world');
    expect(msg.priority).toBe(NotificationPriority.NORMAL);
    expect(msg.category).toBe(NotificationCategory.TRANSACTIONAL);
    expect(msg.idempotencyKey).toBeDefined();
    expect(msg.channelOptions?.snowflakeId).toBeDefined();
    expect(typeof msg.channelOptions?.snowflakeId).toBe('string');
  });

  it('should create an email notification message with ChannelType.EMAIL', () => {
    const { channel, message } = factory.createEmailMessage(
      'admin@example.com',
      'Alert',
      'System updated',
    );

    expect(channel).toBe(ChannelType.EMAIL);
    expect(message.recipientId).toBe('admin@example.com');
    expect(message.subject).toBe('Alert');
    expect(message.body).toBe('System updated');
    expect(message.priority).toBe(NotificationPriority.NORMAL);
  });
});
