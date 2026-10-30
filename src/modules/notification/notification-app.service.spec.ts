import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ChannelType,
  NotificationStatus,
  NotificationCategory,
} from '@bts-soft/core';
import { NotificationService } from './notification.service.js';
import { NotificationMessageFactory } from './factory/notification-message.factory.js';

describe('NotificationService', () => {
  let service: NotificationService;
  const mockCoreService = {
    sendWithResult: vi.fn(),
  };
  const mockDlqService = {
    getStats: vi.fn(),
    listFailedJobs: vi.fn(),
    replayJob: vi.fn(),
    purge: vi.fn(),
  };
  const mockPreferenceRepo = {
    isOptedOut: vi.fn(),
    setOptOut: vi.fn(),
  };
  const mockI18n = {
    t: vi.fn((key: string) => key),
  };
  const messageFactory = new NotificationMessageFactory();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService(
      mockCoreService as unknown as any,
      mockDlqService as unknown as any,
      mockPreferenceRepo as unknown as any,
      messageFactory,
      mockI18n as unknown as any,
    );
  });

  it('should skip sending if user opted out', async () => {
    mockPreferenceRepo.isOptedOut.mockResolvedValue(true);

    const result = await service.sendNotification({
      channel: ChannelType.EMAIL,
      recipientId: 'optout@example.com',
      body: 'Test',
      subject: 'Subject',
    });

    expect(result.status).toBe(NotificationStatus.SKIPPED);
    expect(mockCoreService.sendWithResult).not.toHaveBeenCalled();
  });

  it('should send notification via core service when not opted out', async () => {
    mockPreferenceRepo.isOptedOut.mockResolvedValue(false);
    mockCoreService.sendWithResult.mockResolvedValue({
      status: 'queued',
      jobId: 'job-123',
    });

    const result = await service.sendNotification({
      channel: ChannelType.EMAIL,
      recipientId: 'user@example.com',
      body: 'Test',
      subject: 'Subject',
    });

    expect(result.status).toBe(NotificationStatus.QUEUED);
    expect(result.jobId).toBe('job-123');
    expect(mockCoreService.sendWithResult).toHaveBeenCalled();
  });

  it('should send email using helper method', async () => {
    mockPreferenceRepo.isOptedOut.mockResolvedValue(false);
    mockCoreService.sendWithResult.mockResolvedValue({
      status: 'queued',
      jobId: 'job-email-1',
    });

    const result = await service.sendEmail({
      to: 'email@example.com',
      subject: 'Welcome',
      body: 'Hello',
    });

    expect(result.channel).toBe(ChannelType.EMAIL);
    expect(result.jobId).toBe('job-email-1');
  });

  it('should update preferences', async () => {
    const res = await service.updatePreferences({
      recipientId: 'user-1',
      channel: ChannelType.EMAIL,
      optOut: true,
      category: NotificationCategory.MARKETING,
    });

    expect(mockPreferenceRepo.setOptOut).toHaveBeenCalledWith(
      'user-1',
      ChannelType.EMAIL,
      true,
      NotificationCategory.MARKETING,
    );
    expect(res.isOptedOut).toBe(true);
  });

  it('should get preference status', async () => {
    mockPreferenceRepo.isOptedOut.mockResolvedValue(false);

    const res = await service.getPreferenceStatus('user-1', ChannelType.EMAIL);

    expect(res.isOptedOut).toBe(false);
  });

  it('should retrieve DLQ stats', async () => {
    mockDlqService.getStats.mockResolvedValue({
      totalFailed: 4,
      channels: { email: 4 },
    });

    const res = await service.getDlqStats();

    expect(res.totalFailed).toBe(4);
  });

  it('should retrieve DLQ failed jobs', async () => {
    mockDlqService.listFailedJobs.mockResolvedValue([
      {
        jobId: 'failed-1',
        channel: ChannelType.EMAIL,
        recipientRef: 'u***@example.com',
        failedReason: 'SMTP connection failed',
        attemptsMade: 3,
        failedAt: new Date(),
      },
    ]);

    const jobs = await service.getDlqFailedJobs(ChannelType.EMAIL);

    expect(jobs).toHaveLength(1);
    expect(jobs[0].jobId).toBe('failed-1');
  });

  it('should replay DLQ job successfully', async () => {
    mockDlqService.replayJob.mockResolvedValue({
      status: 'queued',
      jobId: 'replayed-job-1',
    });

    const res = await service.replayDlqJob('job-1', ChannelType.EMAIL);

    expect(res.status).toBe(NotificationStatus.QUEUED);
    expect(res.jobId).toBe('replayed-job-1');
  });

  it('should handle skipped status and direct dispatch fallback', async () => {
    mockPreferenceRepo.isOptedOut.mockResolvedValue(false);
    mockCoreService.sendWithResult.mockResolvedValue({
      status: 'failed',
    });

    const result = await service.sendNotification({
      channel: ChannelType.EMAIL,
      recipientId: 'direct@example.com',
      body: 'Direct body',
    });

    expect(result.status).toBe(NotificationStatus.SKIPPED);
    expect(result.jobId).toBe('direct-dispatch');
  });

  it('should throw NotFoundException when replay DLQ job fails with an Error', async () => {
    mockDlqService.replayJob.mockRejectedValue(new Error('Job not found in DLQ'));

    await expect(
      service.replayDlqJob('missing-job-1', ChannelType.EMAIL),
    ).rejects.toThrow();
  });

  it('should throw NotFoundException when replay DLQ job fails with non-error string', async () => {
    mockDlqService.replayJob.mockRejectedValue('String rejection');

    await expect(
      service.replayDlqJob('missing-job-2'),
    ).rejects.toThrow();
  });

  it('should replay DLQ job with default channel when omitted', async () => {
    mockDlqService.replayJob.mockResolvedValue({
      status: 'skipped',
    });

    const res = await service.replayDlqJob('job-def');
    expect(res.channel).toBe(ChannelType.EMAIL);
    expect(res.status).toBe(NotificationStatus.SKIPPED);
  });

  it('should purge DLQ failed jobs', async () => {
    mockDlqService.purge.mockResolvedValue({ purgedCount: 5 });

    const purged = await service.purgeDlq(ChannelType.EMAIL);

    expect(purged).toBe(5);
  });
});
