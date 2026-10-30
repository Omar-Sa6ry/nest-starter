import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationDomainListener } from './notification-domain.listener.js';
import { UserRegisteredEvent } from '../../../auth/events/domain.events.js';
import { Role } from '../../../../common/constant/enum.constant.js';

describe('NotificationDomainListener', () => {
  let listener: NotificationDomainListener;
  const mockNotificationService = {
    sendEmail: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    listener = new NotificationDomainListener(
      mockNotificationService as unknown as any,
    );
  });

  it('should send welcome email when user registers', async () => {
    mockNotificationService.sendEmail.mockResolvedValue({
      jobId: 'welcome-job-1',
    });

    const event = new UserRegisteredEvent(
      'user-1',
      'welcome@example.com',
      'Omar',
      Role.USER,
    );

    await listener.handleUserRegistered(event);

    expect(mockNotificationService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'welcome@example.com',
        subject: expect.stringContaining('Omar'),
      }),
    );
  });

  it('should not throw if sending welcome email fails', async () => {
    mockNotificationService.sendEmail.mockRejectedValue(
      new Error('Mail transport down'),
    );

    const event = new UserRegisteredEvent(
      'user-2',
      'fail@example.com',
      'Ahmed',
      Role.USER,
    );

    await expect(listener.handleUserRegistered(event)).resolves.not.toThrow();
  });
});
