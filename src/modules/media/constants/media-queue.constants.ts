export const MEDIA_QUEUE_NAME = 'media_processing_queue';

export const MEDIA_JOB_NAMES = {
  PROCESS_PIPELINE: 'process_media_pipeline',
  METADATA_EXTRACTION: 'metadata_extraction',
  SECURITY_SCAN: 'security_scan',
  THUMBNAIL_GENERATION: 'thumbnail_generation',
} as const;

export interface IMediaJobData {
  mediaId: string;
  storageKey: string;
  bucket: string;
  mimeType: string;
  userId: string;
}

