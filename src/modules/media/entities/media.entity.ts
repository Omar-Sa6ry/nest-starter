import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeInsert,
  type Relation,
} from 'typeorm';
import { IdGenerator } from '@bts-soft/core';
import { MediaStatus, MediaTypeCategory } from '../constants/media.constants.js';
import type { IMediaMetadata } from '../interfaces/IMediaMetadata.interface.js';
import type { User } from '../../user/entity/user.entity.js';
import type { MediaVersion } from './media-version.entity.js';
import type { UploadSession } from './upload-session.entity.js';
import type { MediaJob } from './media-job.entity.js';

@Entity('media')
@Index(['uploadedById', 'status'])
@Index(['uploadedById', 'mediaType'])
export class Media {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string = IdGenerator.generate();

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = IdGenerator.generate();
    }
  }

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Index({ unique: true })
  @Column({ name: 'storage_key', type: 'varchar', length: 512 })
  storageKey!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 128 })
  mimeType!: string;

  @Column({
    name: 'media_type',
    type: 'enum',
    enum: MediaTypeCategory,
    default: MediaTypeCategory.OTHER,
  })
  mediaType!: MediaTypeCategory;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ name: 'storage_bucket', type: 'varchar', length: 128 })
  storageBucket!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: MediaStatus,
    default: MediaStatus.PENDING,
  })
  status!: MediaStatus;

  @Column({ name: 'upload_id', type: 'varchar', length: 255, nullable: true })
  uploadId?: string | null;

  @Index()
  @Column({ name: 'uploaded_by_id', type: 'varchar', length: 64, nullable: true })
  uploadedById?: string | null;

  @ManyToOne('User', 'media', {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy?: Relation<User>;

  @OneToMany('MediaVersion', 'media')
  versions?: Relation<MediaVersion[]>;

  @OneToMany('UploadSession', 'media')
  uploadSessions?: Relation<UploadSession[]>;

  @OneToMany('MediaJob', 'media')
  jobs?: Relation<MediaJob[]>;

  @Column({ name: 'checksum', type: 'varchar', length: 128, nullable: true })
  checksum?: string | null;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic!: boolean;

  @Column({ type: 'jsonb', default: [] })
  tags: string[] = [];

  @Column({ type: 'jsonb', default: {} })
  metadata!: IMediaMetadata;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date = new Date();

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date = new Date();

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
