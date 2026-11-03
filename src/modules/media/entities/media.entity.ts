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
} from 'typeorm';
import { IdGenerator } from '@bts-soft/core';
import { MediaStatus, MediaTypeCategory } from '../constants/media.constants.js';
import type { IMediaMetadata } from '../interfaces/IMediaMetadata.interface.js';
import { User } from '../../user/entity/user.entity.js';
import { MediaVersion } from './media-version.entity.js';
import { UploadSession } from './upload-session.entity.js';
import { MediaJob } from './media-job.entity.js';

@Entity('media')
export class Media {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string = IdGenerator.generate();

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
  @Column({ name: 'uploaded_by_id', type: 'varchar', length: 36 })
  uploadedById!: string;

  @ManyToOne(() => User, (user) => user.media, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy?: User;

  @OneToMany(() => MediaVersion, (version) => version.media)
  versions?: MediaVersion[];

  @OneToMany(() => UploadSession, (session) => session.media)
  uploadSessions?: UploadSession[];

  @OneToMany(() => MediaJob, (job) => job.media)
  jobs?: MediaJob[];

  @Column({ name: 'checksum', type: 'varchar', length: 128, nullable: true })
  checksum?: string | null;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic!: boolean;

  @Column({ type: 'jsonb', default: {} })
  metadata!: IMediaMetadata;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date = new Date();

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date = new Date();

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
