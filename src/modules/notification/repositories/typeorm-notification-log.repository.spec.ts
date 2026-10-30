import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TypeOrmNotificationLogRepository } from './typeorm-notification-log.repository.js';
import { NotificationStatus, ChannelType } from '@bts-soft/core';

describe('TypeOrmNotificationLogRepository', () => {
  let repository: TypeOrmNotificationLogRepository;
  const mockRepo = {
    create: vi.fn((dto) => ({ ...dto, id: 'snowflake-log-1' })),
    save: vi.fn(async (entity) => entity),
    update: vi.fn(async () => ({ affected: 1 })),
    findOne: vi.fn(),
    find: vi.fn(),
    createQueryBuilder: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TypeOrmNotificationLogRepository(mockRepo as unknown as any);
  });

  it('should create and save a notification log with snowflake id', async () => {
    const log = await repository.create({
      jobId: 'job-1',
      channel: ChannelType.EMAIL,
      recipientId: 'test@example.com',
      status: NotificationStatus.QUEUED,
      attemptsMade: 1,
      createdAt: new Date(),
    });

    expect(mockRepo.create).toHaveBeenCalled();
    expect(mockRepo.save).toHaveBeenCalled();
    expect(log.jobId).toBe('job-1');
    expect(log.id).toBe('snowflake-log-1');
  });

  it('should update log by jobId', async () => {
    await repository.updateByJobId('job-1', {
      status: NotificationStatus.SENT,
      durationMs: 120,
    });

    expect(mockRepo.update).toHaveBeenCalledWith(
      { jobId: 'job-1' },
      expect.objectContaining({
        status: NotificationStatus.SENT,
        durationMs: 120,
      }),
    );
  });

  it('should find log by jobId', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'log-1',
      jobId: 'job-1',
      channel: ChannelType.EMAIL,
      recipientId: 'test@example.com',
      status: NotificationStatus.SENT,
      attemptsMade: 1,
      createdAt: new Date(),
    });

    const res = await repository.findByJobId('job-1');

    expect(res).not.toBeNull();
    expect(res?.jobId).toBe('job-1');
  });

  it('should find logs by recipientId', async () => {
    mockRepo.find.mockResolvedValue([
      {
        id: 'log-1',
        jobId: 'job-1',
        channel: ChannelType.EMAIL,
        recipientId: 'test@example.com',
        status: NotificationStatus.SENT,
        attemptsMade: 1,
        createdAt: new Date(),
      },
    ]);

    const res = await repository.findByRecipientId('test@example.com');

    expect(res).toHaveLength(1);
    expect(res[0].recipientId).toBe('test@example.com');
  });

  it('should find all with filter', async () => {
    mockRepo.find.mockResolvedValue([]);

    const res = await repository.findAll({ channel: ChannelType.EMAIL });

    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { channel: ChannelType.EMAIL },
      }),
    );
    expect(res).toEqual([]);
  });

  it('should delete logs before cutoff date', async () => {
    const qb = {
      delete: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ affected: 3 }),
    };
    mockRepo.createQueryBuilder.mockReturnValue(qb);

    const count = await repository.deleteBefore(new Date());

    expect(count).toBe(3);
  });
});
