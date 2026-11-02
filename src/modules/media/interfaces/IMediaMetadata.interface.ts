export interface IMediaMetadata {
  etag?: string;
  sha256?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  bitrate?: number;
  originalExtension?: string;
  partsCount?: number;
  custom?: Record<string, string | number | boolean>;
}

export interface IUploadPartItem {
  partNumber: number;
  eTag: string;
}

export interface IQuotaUsage {
  userId: string;
  usedBytes: number;
  quotaBytes: number;
  activeUploads: number;
  maxConcurrent: number;
}

export interface IMediaEventPayload {
  mediaId: string;
  status: string;
  progressPercent?: number;
  uploadedBytes?: number;
  totalBytes?: number;
  message?: string;
  timestamp: string;
}
