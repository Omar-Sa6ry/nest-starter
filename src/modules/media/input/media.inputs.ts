import { InputType, Field, Int } from '@nestjs/graphql';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsBoolean,
  ValidateNested,
  ArrayMinSize,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MEDIA_CONSTANTS,
  MediaTypeCategory,
  MediaStatus,
} from '../constants/media.constants.js';

@InputType()
export class RequestUploadInput {
  @Field(() => String, {
    description: 'Original file name including extension',
  })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @Field(() => String, {
    description: 'MIME type of the file (e.g. image/png, video/mp4)',
  })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @Field(() => Number, {
    description: 'Total file size in bytes (up to 100GB)',
  })
  @IsNumber()
  @Min(1)
  @Max(MEDIA_CONSTANTS.MAX_FILE_SIZE_BYTES)
  sizeBytes!: number;

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description: 'Whether the file should be publicly accessible',
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

@InputType()
export class InitiateMultipartUploadInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @Field(() => Number, { description: 'File size in bytes' })
  @IsNumber()
  @Min(MEDIA_CONSTANTS.MULTIPART_THRESHOLD_BYTES)
  @Max(MEDIA_CONSTANTS.MAX_FILE_SIZE_BYTES)
  sizeBytes!: number;

  @Field(() => Int, {
    nullable: true,
    defaultValue: MEDIA_CONSTANTS.DEFAULT_PART_SIZE_BYTES,
    description: 'Size of each chunk in bytes (default 10MB)',
  })
  @IsOptional()
  @IsNumber()
  @Min(5 * 1024 * 1024) // S3 minimum part size is 5MB except last part
  partSizeBytes?: number;

  @Field(() => Boolean, { nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

@InputType()
export class UploadPartInput {
  @Field(() => Int)
  @IsNumber()
  @Min(1)
  @Max(MEDIA_CONSTANTS.MAX_PARTS_COUNT)
  partNumber!: number;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  eTag!: string;
}

@InputType()
export class CompleteMultipartUploadInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  mediaId!: string;

  @Field(() => [UploadPartInput])
  @ValidateNested({ each: true })
  @Type(() => UploadPartInput)
  @ArrayMinSize(1)
  parts!: UploadPartInput[];
}

@InputType()
export class AbortMultipartUploadInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  mediaId!: string;
}

@InputType()
export class CreateUploadSessionInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @Field(() => Number)
  @IsNumber()
  @Min(1)
  @Max(MEDIA_CONSTANTS.MAX_FILE_SIZE_BYTES)
  size!: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  checksum?: string;
}

@InputType()
export class CompleteUploadInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  uploadId!: string;

  @Field(() => [UploadPartInput])
  @ValidateNested({ each: true })
  @Type(() => UploadPartInput)
  @ArrayMinSize(1)
  parts!: UploadPartInput[];
}

@InputType()
export class UpdateMediaInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  mediaId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}

@InputType()
export class MediaListFilterInput {
  @Field(() => MediaTypeCategory, { nullable: true })
  @IsOptional()
  @IsEnum(MediaTypeCategory)
  mediaType?: MediaTypeCategory;

  @Field(() => MediaStatus, { nullable: true })
  @IsOptional()
  @IsEnum(MediaStatus)
  status?: MediaStatus;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  toDate?: string;
}
