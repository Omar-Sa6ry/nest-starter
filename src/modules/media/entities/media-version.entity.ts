import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IdGenerator } from '@bts-soft/core';
import { VersionType } from '../constants/media.constants.js';
import { Media } from './media.entity.js';

@Entity('media_versions')
export class MediaVersion {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string = IdGenerator.generate();

  @Index()
  @Column({ name: 'media_id', type: 'varchar', length: 36 })
  mediaId!: string;

  @ManyToOne(() => Media, (media) => media.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'media_id' })
  media?: Media;

  @Column({
    name: 'version_type',
    type: 'varchar',
    length: 32,
    default: VersionType.ORIGINAL,
  })
  versionType!: VersionType;

  @Column({ name: 'storage_key', type: 'varchar', length: 512 })
  storageKey!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 128 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  checksum?: string | null;

  @Column({ type: 'int', nullable: true })
  width?: number | null;

  @Column({ type: 'int', nullable: true })
  height?: number | null;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds?: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date = new Date();
}

