import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, IsNull, Or } from 'typeorm';
import {
  INotificationOutboxRepository,
  NotificationOutboxRecord,
  CreateNotificationOutboxRecord,
  ClaimOutboxBatchOptions,
  OutboxRetryUpdate,
  DEFAULT_NOTIFICATION_OUTBOX_MAX_ATTEMPTS,
  IdGenerator,
} from '@bts-soft/core';
import { NotificationOutboxEntity } from '../entities/notification-outbox.entity.js';

@Injectable()
export class TypeOrmNotificationOutboxRepository implements INotificationOutboxRepository {
  constructor(
    @InjectRepository(NotificationOutboxEntity)
    private readonly repo: Repository<NotificationOutboxEntity>,
  ) {}

  async create(record: CreateNotificationOutboxRecord): Promise<void> {
    const entity = this.repo.create({
      id: record.id || IdGenerator.generate('snowflake'),
      channel: record.channel,
      message: record.message,
      state: 'pending',
      attemptsMade: 0,
      maxAttempts:
        record.maxAttempts ?? DEFAULT_NOTIFICATION_OUTBOX_MAX_ATTEMPTS,
      createdAt: record.createdAt ?? new Date(),
      availableAt: record.createdAt ?? new Date(),
    });

    await this.repo.save(entity);
  }

  async claimBatch(
    options: ClaimOutboxBatchOptions,
  ): Promise<NotificationOutboxRecord[]> {
    const leaseUntil = new Date(options.now.getTime() + options.leaseMs);

    // Atomically find eligible rows
    const candidates = await this.repo.find({
      where: [
        {
          state: 'pending',
          availableAt: LessThanOrEqual(options.now),
          leaseUntil: Or(IsNull(), LessThanOrEqual(options.now)),
        },
      ],
      order: { createdAt: 'ASC' },
      take: options.limit,
    });

    if (candidates.length === 0) return [];

    const claimed: NotificationOutboxRecord[] = [];
    for (const entity of candidates) {
      entity.state = 'processing';
      entity.leaseUntil = leaseUntil;
      entity.attemptsMade += 1;
      const updated = await this.repo.save(entity);

      claimed.push({
        id: updated.id,
        channel: updated.channel,
        message: updated.message,
        state: updated.state,
        attemptsMade: updated.attemptsMade,
        maxAttempts: updated.maxAttempts,
        createdAt: updated.createdAt,
        availableAt: updated.availableAt,
        leaseUntil: updated.leaseUntil,
        jobId: updated.jobId,
        lastError: updated.lastError,
        completedAt: updated.completedAt,
      });
    }

    return claimed;
  }

  async markEnqueued(
    id: string,
    jobId: string,
    completedAt: Date,
  ): Promise<void> {
    await this.repo.update(
      { id },
      {
        state: 'enqueued',
        jobId,
        completedAt,
        leaseUntil: undefined,
      },
    );
  }

  async markSkipped(
    id: string,
    reason: string,
    completedAt: Date,
  ): Promise<void> {
    await this.repo.update(
      { id },
      {
        state: 'skipped',
        lastError: reason,
        completedAt,
        leaseUntil: undefined,
      },
    );
  }

  async scheduleRetry(id: string, update: OutboxRetryUpdate): Promise<void> {
    await this.repo.update(
      { id },
      {
        state: 'pending',
        attemptsMade: update.attemptsMade,
        availableAt: update.availableAt,
        lastError: update.error,
        leaseUntil: undefined,
      },
    );
  }

  async markDead(
    id: string,
    update: Pick<OutboxRetryUpdate, 'attemptsMade' | 'error'>,
  ): Promise<void> {
    await this.repo.update(
      { id },
      {
        state: 'dead',
        attemptsMade: update.attemptsMade,
        lastError: update.error,
        leaseUntil: undefined,
      },
    );
  }

  async requeueDead(id: string, availableAt: Date): Promise<void> {
    await this.repo.update(
      { id },
      {
        state: 'pending',
        attemptsMade: 0,
        availableAt,
        lastError: undefined,
        leaseUntil: undefined,
      },
    );
  }

  async purgeCompletedBefore(cutoff: Date): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .from(NotificationOutboxEntity)
      .where('state IN (:...states) AND completed_at < :cutoff', {
        states: ['enqueued', 'skipped'],
        cutoff,
      })
      .execute();

    return result.affected ?? 0;
  }
}
