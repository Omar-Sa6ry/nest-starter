import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { IdGenerator } from '@bts-soft/core';

export enum MediaJobType {
  SCAN = 'SCAN',
  COMPRESS = 'COMPRESS',
  THUMBNAIL = 'THUMBNAIL',
  TRANSCODE = 'TRANSCODE',
  METADATA_EXTRACTION = 'METADATA_EXTRACTION',
  DELETE = 'DELETE',
  IMAGE_PROCESS = 'IMAGE_PROCESS',
}

export enum MediaJobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DLQ = 'DLQ',
}

@Entity('media_jobs')
export class MediaJob {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string = IdGenerator.generate();

  @Index()
  @Column({ name: 'media_id', type: 'varchar', length: 36 })
  mediaId!: string;

  @Column({
    name: 'job_type',
    type: 'enum',
    enum: MediaJobType,
  })
  jobType!: MediaJobType;

  @Index()
  @Column({
    type: 'enum',
    enum: MediaJobStatus,
    default: MediaJobStatus.PENDING,
  })
  status!: MediaJobStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'max_attempts', type: 'int', default: 3 })
  maxAttempts!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date = new Date();

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date = new Date();
}

