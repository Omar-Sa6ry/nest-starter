import type { MediaTypeCategory, MediaStatus } from '../constants/media.constants.js';

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
  timestamp?: string;
}

export interface ISseMessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

export interface IMediaPaginationFilter {
  mediaType?: MediaTypeCategory;
  status?: MediaStatus;
  fromDate?: string;
  toDate?: string;
  tags?: string[];
}

export interface IMediaUpdatePayload {
  fileName?: string;
  isPublic?: boolean;
  tags?: string[];
}

export interface IPresignedPart {
  partNumber: number;
  uploadUrl: string;
  presignedUrl?: string;
}
