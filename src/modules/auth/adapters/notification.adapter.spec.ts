import { describe, it, expect, beforeEach, vi, type Mocked } from 'vitest';
import { NotificationAdapter } from './notification.adapter.js';
import { NotificationService } from '../../notification/notification.service.js';

describe('NotificationAdapter', () => {
  let adapter: NotificationAdapter;
  let mockNotificationService: Mocked<NotificationService>;

  beforeEach(() => {
    mockNotificationService = {
      sendEmail: vi.fn().mockResolvedValue({
        jobId: 'job-123',
        channel: 'email',
        recipientId: 'test@example.com',
        status: 'queued',
      }),
    } as unknown as Mocked<NotificationService>;

    adapter = new NotificationAdapter(mockNotificationService);
  });

  describe('sendEmail', () => {
    it('sends email via notification service', async () => {
      await adapter.sendEmail(
        'test@example.com',
        'Test Subject',
        'Test Body',
        { name: 'Test' },
      );

      expect(mockNotificationService.sendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        context: { name: 'Test' },
      });
    });

    it('handles special characters in email and context', async () => {
      await adapter.sendEmail(
        'user+tag@example.com',
        'Subject with "quotes"',
        'Body with {braces}',
        { email: 'user+tag@example.com', code: '123-456' },
      );

      expect(mockNotificationService.sendEmail).toHaveBeenCalledWith({
        to: 'user+tag@example.com',
        subject: 'Subject with "quotes"',
        body: 'Body with {braces}',
        context: { email: 'user+tag@example.com', code: '123-456' },
      });
    });

    it('handles empty context', async () => {
      await adapter.sendEmail('test@example.com', 'Subject', 'Body', {});

      expect(mockNotificationService.sendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Subject',
        body: 'Body',
        context: {},
      });
    });

    it('does nothing when notification service is not provided', async () => {
      const adapterWithoutService = new NotificationAdapter(undefined);

      await expect(
        adapterWithoutService.sendEmail('test@example.com', 'Subject', 'Body', {})
      ).resolves.toBeUndefined();
    });

    it('propagates errors from notification service', async () => {
      const error = new Error('SMTP connection failed');
      mockNotificationService.sendEmail.mockRejectedValue(error);

      await expect(
        adapter.sendEmail('test@example.com', 'Subject', 'Body', {})
      ).rejects.toThrow('SMTP connection failed');
    });
  });
});