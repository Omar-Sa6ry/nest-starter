import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ChannelType, NotificationStatus } from '@bts-soft/core';

@Entity('notification_logs')
export class NotificationLogEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ name: 'job_id', type: 'varchar', length: 128 })
  @Index()
  jobId: string;

  @Column({ type: 'varchar', length: 64 })
  @Index()
  channel: ChannelType | string;

  @Column({ name: 'recipient_id', type: 'varchar', length: 255 })
  @Index()
  recipientId: string;

  @Column({ type: 'varchar', length: 32, default: NotificationStatus.PENDING })
  @Index()
  status: NotificationStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'provider_message_id', type: 'varchar', length: 255, nullable: true })
  providerMessageId?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  provider?: string | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs?: number | null;

  @Column({ name: 'attempts_made', type: 'int', default: 0 })
  attemptsMade: number;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
