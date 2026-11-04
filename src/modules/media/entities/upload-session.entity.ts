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
import { IdGenerator } from '@bts-soft/core';
import type { IUploadPartItem } from '../interfaces/IMediaMetadata.interface.js';
import type { Media } from './media.entity.js';
import type { User } from '../../user/entity/user.entity.js';
import { UploadSessionStatus } from '../enums/upload-session.enum.js';

@Entity('upload_sessions')
@Index(['userId', 'status'])
export class UploadSession {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string = IdGenerator.generate();

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = IdGenerator.generate();
    }
  }

  @Index()
  @Column({ name: 'media_id', type: 'varchar', length: 36 })
  mediaId!: string;

  @ManyToOne('Media', 'uploadSessions', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'media_id' })
  media?: Relation<Media>;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User>;

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
