import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  INotificationLogRepository,
  NotificationLog,
  IdGenerator,
} from '@bts-soft/core';
import { NotificationLogEntity } from '../entities/notification-log.entity.js';

@Injectable()
export class TypeOrmNotificationLogRepository implements INotificationLogRepository {
  constructor(
    @InjectRepository(NotificationLogEntity)
    private readonly repo: Repository<NotificationLogEntity>,
  ) {}

  async create(log: Omit<NotificationLog, 'id'>): Promise<NotificationLog> {
    const entity = this.repo.create({
      id: IdGenerator.generate('snowflake'),
      jobId: log.jobId,
      channel: log.channel,
      recipientId: log.recipientId,
      status: log.status,
      errorMessage: log.errorMessage,
      providerMessageId: log.providerMessageId,
      provider: log.provider,
      durationMs: log.durationMs,
      attemptsMade: log.attemptsMade ?? 0,
      createdAt: log.createdAt ?? new Date(),
    });

    const saved = await this.repo.save(entity);
    return this.toLog(saved);
  }

  async updateByJobId(
    jobId: string,
    update: Partial<NotificationLog>,
  ): Promise<void> {
    await this.repo.update(
      { jobId },
      {
        ...(update.status !== undefined ? { status: update.status } : {}),
        ...(update.errorMessage !== undefined
          ? { errorMessage: update.errorMessage }
          : {}),
        ...(update.providerMessageId !== undefined
          ? { providerMessageId: update.providerMessageId }
          : {}),
        ...(update.provider !== undefined ? { provider: update.provider } : {}),
        ...(update.durationMs !== undefined
          ? { durationMs: update.durationMs }
          : {}),
        ...(update.attemptsMade !== undefined
          ? { attemptsMade: update.attemptsMade }
          : {}),
      },
    );
  }

  async findByJobId(jobId: string): Promise<NotificationLog | null> {
    const entity = await this.repo.findOne({ where: { jobId } });
    return entity ? this.toLog(entity) : null;
  }

  async findByRecipientId(recipientId: string): Promise<NotificationLog[]> {
    const entities = await this.repo.find({
      where: { recipientId },
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.toLog(e));
  }

  async findAll(filter?: Partial<NotificationLog>): Promise<NotificationLog[]> {
    const where: Record<string, unknown> = {};
    if (filter?.channel) where.channel = filter.channel;
    if (filter?.recipientId) where.recipientId = filter.recipientId;
    if (filter?.status) where.status = filter.status;
    if (filter?.jobId) where.jobId = filter.jobId;

    const entities = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return entities.map((e) => this.toLog(e));
  }

  async deleteBefore(cutoff: Date): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .from(NotificationLogEntity)
      .where('created_at < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }

  private toLog(entity: NotificationLogEntity): NotificationLog {
    return {
      id: entity.id,
      jobId: entity.jobId,
      channel: entity.channel,
      recipientId: entity.recipientId,
      status: entity.status,
      errorMessage: entity.errorMessage,
      providerMessageId: entity.providerMessageId,
      provider: entity.provider,
      durationMs: entity.durationMs,
      attemptsMade: entity.attemptsMade,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
