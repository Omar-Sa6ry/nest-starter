import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import {
  ChannelType,
  type NotificationMessage,
  type NotificationOutboxState,
} from '@bts-soft/core';

@Entity('notification_outbox')
export class NotificationOutboxEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 64 })
  @Index()
  channel: ChannelType;

  @Column({ type: 'jsonb' })
  message: NotificationMessage;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  @Index()
  state: NotificationOutboxState;

  @Column({ name: 'attempts_made', type: 'int', default: 0 })
  attemptsMade: number;

  @Column({ name: 'max_attempts', type: 'int', default: 8 })
  maxAttempts: number;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  @Column({ name: 'available_at', type: 'timestamp with time zone' })
  @Index()
  availableAt: Date;

  @Column({ name: 'lease_until', type: 'timestamp with time zone', nullable: true })
  @Index()
  leaseUntil?: Date;

  @Column({ name: 'job_id', type: 'varchar', length: 128, nullable: true })
  jobId?: string;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string;

  @Column({ name: 'completed_at', type: 'timestamp with time zone', nullable: true })
  completedAt?: Date;
}
