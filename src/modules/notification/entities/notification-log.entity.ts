import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  type Relation,
} from 'typeorm';
import { ChannelType, NotificationStatus, IdGenerator } from '@bts-soft/core';
import type { User } from '../../user/entity/user.entity.js';

@Entity('notification_logs')
export class NotificationLogEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string = IdGenerator.generate();

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = IdGenerator.generate();
    }
  }

  @Column({ name: 'job_id', type: 'varchar', length: 128 })
  @Index()
  jobId: string;

  @Column({ type: 'varchar', length: 64 })
  @Index()
  channel: ChannelType | string;

  @Column({ name: 'recipient_id', type: 'varchar', length: 255 })
  @Index()
  recipientId: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  userId?: string | null;

  @ManyToOne('User', 'notifications', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User>;

  @Column({ type: 'varchar', length: 32, default: NotificationStatus.PENDING })
  @Index()
  status: NotificationStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({
    name: 'provider_message_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
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
