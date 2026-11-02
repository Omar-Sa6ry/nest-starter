import { ObjectType, Field, Int, registerEnumType } from '@nestjs/graphql';
import { MediaStatus, MediaTypeCategory, VersionType } from '../constants/media.constants.js';

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

@ObjectType({ description: 'Presigned upload part item for multipart uploads' })
export class PresignedPartUrlType {
  @Field(() => Int)
  partNumber!: number;

  @Field(() => String)
  uploadUrl!: string;
}

@ObjectType({ description: 'Response when initiating a direct single or multipart upload' })
export class PresignedUploadResponseData {
  @Field(() => String)
  mediaId!: string;

  @Field(() => String, { nullable: true })
  uploadUrl?: string;

  @Field(() => String, { nullable: true })
  uploadId?: string;

  @Field(() => String, { nullable: true })
  s3UploadId?: string;

  @Field(() => [PresignedPartUrlType], { nullable: true })
  parts?: PresignedPartUrlType[];

  @Field(() => [PresignedPartUrlType], { nullable: true })
  presignedParts?: PresignedPartUrlType[];

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

@ObjectType({ description: 'Media item details' })
export class MediaType {
  @Field(() => String)
  id!: string;

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

  @Field(() => String, { nullable: true })
  downloadUrl?: string;

  @Field(() => [MediaVersionType], { nullable: true })
  versions?: MediaVersionType[];

  @Field(() => String)
  createdAt!: string;

  @Field(() => String)
  updatedAt!: string;
}

@ObjectType({ description: 'Standard General Response wrapper for single Media' })
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

@ObjectType({ description: 'Standard General Response wrapper for presigned upload creation' })
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
  @Field(() => String)
  mediaId!: string;

  @Field(() => String)
  downloadUrl!: string;

  @Field(() => Int)
  expiresInSeconds!: number;
}

@ObjectType({ description: 'Standard General Response wrapper for download URL' })
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

@ObjectType({ description: 'Standard General Response wrapper for paginated media' })
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

@ObjectType({ description: 'Standard General Response wrapper for quota usage' })
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
