import { ObjectType, Field, Int } from '@nestjs/graphql';
import {
  MediaStatus,
  MediaTypeCategory,
  VersionType,
} from '../constants/media.constants.js';
import { MediaJobType, MediaJobStatus } from '../enums/media-job.enum.js';

@ObjectType({ description: 'Presigned upload part item for multipart uploads' })
export class PresignedPartUrlType {
  @Field(() => Int)
  partNumber!: number;

  @Field(() => String)
  uploadUrl!: string;

  @Field(() => String, { nullable: true })
  presignedUrl?: string;
}

@ObjectType({
  description: 'Response when initiating a direct single or multipart upload',
})
export class PresignedUploadResponseData {
  @Field(() => String)
  mediaId!: string;

  @Field(() => String, { nullable: true })
  uploadUrl?: string;

  @Field(() => String, { nullable: true })
  uploadId?: string;

  @Field(() => [PresignedPartUrlType], { nullable: true })
  parts?: PresignedPartUrlType[];

  @Field(() => Int, { nullable: true })
  partSize?: number;

  @Field(() => Int, { nullable: true })
  totalParts?: number;

  @Field(() => String, { nullable: true })
  expiresAt?: string;

  @Field(() => String)
  storageKey!: string;

  @Field(() => Boolean)
  isMultipart!: boolean;

  @Field(() => Int)
  expiresInSeconds!: number;
}

@ObjectType({ description: 'Media version rendition' })
export class MediaVersionType {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  mediaId!: string;

  @Field(() => VersionType)
  versionType!: VersionType;

  @Field(() => String)
  storageKey!: string;

  @Field(() => String)
  mimeType!: string;

  @Field(() => String)
  sizeBytes!: string;

  @Field(() => Int, { nullable: true })
  width?: number | null;

  @Field(() => Int, { nullable: true })
  height?: number | null;

  @Field(() => Int, { nullable: true })
  durationSeconds?: number | null;
}

@ObjectType({ description: 'Quota and usage details' })
export class QuotaUsageType {
  @Field(() => String)
  userId!: string;

  @Field(() => String)
  usedBytes!: string;

  @Field(() => String)
  quotaBytes!: string;

  @Field(() => Int)
  activeUploads!: number;

  @Field(() => Int)
  maxConcurrent!: number;
}

@ObjectType({ description: 'Media processing job item' })
export class MediaJobObjectType {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  mediaId!: string;

  @Field(() => MediaJobType)
  jobType!: MediaJobType;

  @Field(() => MediaJobStatus)
  status!: MediaJobStatus;

  @Field(() => Int)
  attempts!: number;

  @Field(() => Int)
  maxAttempts!: number;

  @Field(() => String, { nullable: true })
  lastError?: string | null;

  @Field(() => String, { nullable: true })
  startedAt?: string | null;

  @Field(() => String, { nullable: true })
  completedAt?: string | null;

  @Field(() => String)
  createdAt!: string;
}

@ObjectType({ description: 'Media item details' })
export class MediaType {
  @Field(() => String)
  id!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Deprecated alias for id to ensure backwards compatibility',
  })
  mediaId?: string;

  @Field(() => String)
  fileName!: string;

  @Field(() => String)
  storageKey!: string;

  @Field(() => String)
  mimeType!: string;

  @Field(() => MediaTypeCategory)
  mediaType!: MediaTypeCategory;

  @Field(() => String)
  sizeBytes!: string;

  @Field(() => MediaStatus)
  status!: MediaStatus;

  @Field(() => String)
  uploadedById!: string;

  @Field(() => String, { nullable: true })
  checksum?: string | null;

  @Field(() => Boolean)
  isPublic!: boolean;

  @Field(() => [String], { defaultValue: [] })
  tags!: string[];

  @Field(() => String, { nullable: true })
  downloadUrl?: string;

  @Field(() => [MediaVersionType], { nullable: true })
  versions?: MediaVersionType[];

  @Field(() => String)
  createdAt!: string;

  @Field(() => String)
  updatedAt!: string;
}

@ObjectType({
  description: 'Standard General Response wrapper for single Media',
})
export class MediaResponse {
  @Field(() => Boolean)
  success!: boolean;

  @Field(() => Int)
  statusCode!: number;

  @Field(() => String)
  message!: string;

  @Field(() => String)
  timeStamp!: string;

  @Field(() => MediaType, { nullable: true })
  data?: MediaType | null;
}

@ObjectType({
  description:
    'Standard General Response wrapper for presigned upload creation',
})
export class PresignedUploadResponse {
  @Field(() => Boolean)
  success!: boolean;

  @Field(() => Int)
  statusCode!: number;

  @Field(() => String)
  message!: string;

  @Field(() => String)
  timeStamp!: string;

  @Field(() => PresignedUploadResponseData, { nullable: true })
  data?: PresignedUploadResponseData | null;
}

@ObjectType({ description: 'Download URL result wrapper' })
export class DownloadUrlData {
  @Field(() => String, { nullable: true })
  mediaId?: string;

  @Field(() => String)
  downloadUrl!: string;

  @Field(() => Int)
  expiresInSeconds!: number;

  @Field(() => Number, { nullable: true })
  expiresAt?: number;

  @Field(() => String, { nullable: true })
  contentType?: string;
}

@ObjectType({
  description: 'Standard General Response wrapper for download URL',
})
export class DownloadUrlResponse {
  @Field(() => Boolean)
  success!: boolean;

  @Field(() => Int)
  statusCode!: number;

  @Field(() => String)
  message!: string;

  @Field(() => String)
  timeStamp!: string;

  @Field(() => DownloadUrlData, { nullable: true })
  data?: DownloadUrlData | null;
}

@ObjectType({ description: 'Paginated media list data' })
export class PaginatedMediaData {
  @Field(() => [MediaType])
  items!: MediaType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  limit!: number;

  @Field(() => Int)
  totalPages!: number;
}

@ObjectType({
  description: 'Standard General Response wrapper for paginated media',
})
export class PaginatedMediaResponse {
  @Field(() => Boolean)
  success!: boolean;

  @Field(() => Int)
  statusCode!: number;

  @Field(() => String)
  message!: string;

  @Field(() => String)
  timeStamp!: string;

  @Field(() => PaginatedMediaData, { nullable: true })
  data?: PaginatedMediaData | null;
}

@ObjectType({
  description: 'Standard General Response wrapper for quota usage',
})
export class QuotaResponse {
  @Field(() => Boolean)
  success!: boolean;

  @Field(() => Int)
  statusCode!: number;

  @Field(() => String)
  message!: string;

  @Field(() => String)
  timeStamp!: string;

  @Field(() => QuotaUsageType, { nullable: true })
  data?: QuotaUsageType | null;
}

@ObjectType({ description: 'Upload status details for resumable uploads' })
export class UploadStatusData {
  @Field(() => String)
  uploadId!: string;

  @Field(() => String)
  status!: string;

  @Field(() => Int)
  totalParts!: number;

  @Field(() => Int)
  completedParts!: number;

  @Field(() => [Int])
  missingParts!: number[];

  @Field(() => Number)
  expiresAt!: number;
}

@ObjectType({
  description: 'Standard General Response wrapper for upload status',
})
export class UploadStatusResponse {
  @Field(() => Boolean)
  success!: boolean;

  @Field(() => Int)
  statusCode!: number;

  @Field(() => String)
  message!: string;

  @Field(() => String)
  timeStamp!: string;

  @Field(() => UploadStatusData, { nullable: true })
  data?: UploadStatusData | null;
}

@ObjectType({ description: 'General Operation Response' })
export class MediaGeneralOperationResponse {
  @Field(() => Boolean)
  success!: boolean;

  @Field(() => Int)
  statusCode!: number;

  @Field(() => String)
  message!: string;

  @Field(() => String)
  timeStamp!: string;
}

@ObjectType({ description: 'Response wrapper for media versions list' })
export class MediaVersionResponse {
  @Field(() => Boolean)
  success!: boolean;

  @Field(() => Int)
  statusCode!: number;

  @Field(() => String)
  message!: string;

  @Field(() => String)
  timeStamp!: string;

  @Field(() => [MediaVersionType], { nullable: true })
  data?: MediaVersionType[] | null;
}

@ObjectType({ description: 'Response wrapper for media jobs list' })
export class MediaJobResponse {
  @Field(() => Boolean)
  success!: boolean;

  @Field(() => Int)
  statusCode!: number;

  @Field(() => String)
  message!: string;

  @Field(() => String)
  timeStamp!: string;

  @Field(() => [MediaJobObjectType], { nullable: true })
  data?: MediaJobObjectType[] | null;
}
