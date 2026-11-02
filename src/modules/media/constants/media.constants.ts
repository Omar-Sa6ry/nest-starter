import { registerEnumType } from '@nestjs/graphql';

export const MEDIA_CONSTANTS = {
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024 * 1024, // 100 GB (Enterprise scale)
  MIN_FILE_SIZE_BYTES: 1,
  MULTIPART_THRESHOLD_BYTES: 50 * 1024 * 1024, // 50 MB
  DEFAULT_PART_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB per chunk
  MIN_PART_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB minimum for AWS S3
  MAX_PARTS_COUNT: 10000,
  DEFAULT_PRESIGNED_EXPIRES_SECONDS: 3600, // 1 hour
  DEFAULT_QUOTA_BYTES: 50 * 1024 * 1024 * 1024, // 50 GB default quota per user
  MAX_CONCURRENT_UPLOADS: 5,
} as const;

export enum MediaStatus {
  PENDING = 'PENDING',
  UPLOADING = 'UPLOADING',
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
  QUARANTINED = 'QUARANTINED',
  ABORTED = 'ABORTED',
  DELETED = 'DELETED',
}

export enum MediaTypeCategory {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
  ARCHIVE = 'ARCHIVE',
  OTHER = 'OTHER',
}

export enum VersionType {
  ORIGINAL = 'original',
  THUMBNAIL = 'thumbnail',
  MEDIUM = 'medium',
  OPTIMIZED = 'optimized',
  HD_720P = '720p',
  FULL_HD_1080P = '1080p',
  WEBP = 'webp',
  AVIF = 'avif',
  HLS = 'hls',
}

// State transition validation matrix matching system design standards
export const ALLOWED_STATUS_TRANSITIONS: Record<MediaStatus, MediaStatus[]> = {
  [MediaStatus.PENDING]: [
    MediaStatus.UPLOADING,
    MediaStatus.READY,
    MediaStatus.FAILED,
    MediaStatus.ABORTED,
  ],
  [MediaStatus.UPLOADING]: [
    MediaStatus.UPLOADED,
    MediaStatus.READY,
    MediaStatus.ABORTED,
    MediaStatus.FAILED,
  ],
  [MediaStatus.UPLOADED]: [
    MediaStatus.PROCESSING,
    MediaStatus.READY,
    MediaStatus.FAILED,
  ],
  [MediaStatus.PROCESSING]: [
    MediaStatus.READY,
    MediaStatus.FAILED,
    MediaStatus.QUARANTINED,
  ],
  [MediaStatus.READY]: [MediaStatus.DELETED],
  [MediaStatus.FAILED]: [MediaStatus.DELETED],
  [MediaStatus.QUARANTINED]: [MediaStatus.DELETED],
  [MediaStatus.ABORTED]: [MediaStatus.DELETED],
  [MediaStatus.DELETED]: [],
};

registerEnumType(MediaStatus, {
  name: 'MediaStatus',
  description: 'Lifecycle statuses of a media item',
});

registerEnumType(MediaTypeCategory, {
  name: 'MediaTypeCategory',
  description: 'Top-level media type classification',
});

registerEnumType(VersionType, {
  name: 'VersionType',
  description: 'Types of renditions or versions generated for a media file',
});
