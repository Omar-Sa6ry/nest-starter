import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TypeOrmNotificationOutboxRepository } from './typeorm-notification-outbox.repository.js';
import { ChannelType } from '@bts-soft/core';

describe('TypeOrmNotificationOutboxRepository', () => {
  let repository: TypeOrmNotificationOutboxRepository;
  const mockRepo = {
    create: vi.fn((dto) => ({ ...dto, id: 'outbox-snowflake-1' })),
    save: vi.fn(async (entity) => entity),
    update: vi.fn(async () => ({ affected: 1 })),
    find: vi.fn(),
    createQueryBuilder: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TypeOrmNotificationOutboxRepository(
      mockRepo as unknown as any,
    );
  });

  it('should create an outbox record with pending state', async () => {
    await repository.create({
      id: 'outbox-1',
      channel: ChannelType.EMAIL,
      message: {
        recipientId: 'recipient@example.com',
        body: 'Hello',
      },
    });

    expect(mockRepo.create).toHaveBeenCalled();
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should claim batch and advance attempts and lease', async () => {
    mockRepo.find.mockResolvedValue([
      {
        id: 'outbox-1',
        channel: ChannelType.EMAIL,
        message: { recipientId: 'user@example.com', body: 'Hi' },
        state: 'pending',
        attemptsMade: 0,
        maxAttempts: 5,
        createdAt: new Date(),
        availableAt: new Date(),
      },
    ]);

    const claimed = await repository.claimBatch({
      limit: 10,
      leaseMs: 5000,
      now: new Date(),
    });

    expect(claimed).toHaveLength(1);
    expect(claimed[0].attemptsMade).toBe(1);
    expect(claimed[0].state).toBe('processing');
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should mark enqueued', async () => {
    await repository.markEnqueued('outbox-1', 'job-123', new Date());

    expect(mockRepo.update).toHaveBeenCalledWith(
      { id: 'outbox-1' },
      expect.objectContaining({
        state: 'enqueued',
        jobId: 'job-123',
      }),
    );
  });

  it('should mark skipped', async () => {
    await repository.markSkipped('outbox-1', 'User opted out', new Date());

    expect(mockRepo.update).toHaveBeenCalledWith(
      { id: 'outbox-1' },
      expect.objectContaining({
        state: 'skipped',
        lastError: 'User opted out',
      }),
    );
  });

  it('should schedule retry', async () => {
    await repository.scheduleRetry('outbox-1', {
      attemptsMade: 2,
      availableAt: new Date(),
      error: 'Timeout',
    });

    expect(mockRepo.update).toHaveBeenCalledWith(
      { id: 'outbox-1' },
      expect.objectContaining({
        state: 'pending',
        attemptsMade: 2,
        lastError: 'Timeout',
      }),
    );
  });

  it('should mark dead', async () => {
    await repository.markDead('outbox-1', {
      attemptsMade: 5,
      error: 'Max retries exhausted',
    });

    expect(mockRepo.update).toHaveBeenCalledWith(
      { id: 'outbox-1' },
      expect.objectContaining({
        state: 'dead',
        attemptsMade: 5,
      }),
    );
  });

  it('should requeue dead record', async () => {
    await repository.requeueDead('outbox-1', new Date());

    expect(mockRepo.update).toHaveBeenCalledWith(
      { id: 'outbox-1' },
      expect.objectContaining({
        state: 'pending',
        attemptsMade: 0,
      }),
    );
  });

  it('should purge completed before date', async () => {
    const qb = {
      delete: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ affected: 4 }),
    };
    mockRepo.createQueryBuilder.mockReturnValue(qb);

    const purged = await repository.purgeCompletedBefore(new Date());

    expect(purged).toBe(4);
  });
});
