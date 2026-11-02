import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { IdGenerator } from '@bts-soft/core';
import type { IUploadPartItem } from '../interfaces/IMediaMetadata.interface.js';

export enum UploadSessionStatus {
  PENDING = 'PENDING',
  UPLOADING = 'UPLOADING',
  COMPLETED = 'COMPLETED',
  ABORTED = 'ABORTED',
  EXPIRED = 'EXPIRED',
}

@Entity('upload_sessions')
export class UploadSession {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string = IdGenerator.generate();

  @Index()
  @Column({ name: 'media_id', type: 'varchar', length: 36 })
  mediaId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @Column({ name: 's3_upload_id', type: 'varchar', length: 255 })
  s3UploadId!: string;

  @Column({ name: 'object_key', type: 'varchar', length: 512 })
  objectKey!: string;

  @Column({ name: 'total_parts', type: 'int' })
  totalParts!: number;

  @Column({ name: 'part_size_bytes', type: 'bigint' })
  partSizeBytes!: string;

  @Column({
    type: 'enum',
    enum: UploadSessionStatus,
    default: UploadSessionStatus.PENDING,
  })
  status!: UploadSessionStatus;

  @Column({ type: 'jsonb', default: [] })
  completedParts!: IUploadPartItem[];

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date = new Date();

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date = new Date();
}

