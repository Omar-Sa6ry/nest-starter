import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Media } from '../entity/media.entity.js';
import { MediaVersion } from '../entity/media-version.entity.js';
import { UploadSession, UploadSessionStatus } from '../entity/upload-session.entity.js';
import { S3StorageService } from './s3-storage.service.js';
import { MediaSseService } from './media-sse.service.js';
import { MediaQuotaService } from './media-quota.service.js';
import { MediaValidationService } from './media-validation.service.js';
import {
  MEDIA_CONSTANTS,
  MediaStatus,
  MediaTypeCategory,
  VersionType,
  ALLOWED_STATUS_TRANSITIONS,
} from '../constants/media.constants.js';
import type {
  RequestUploadInput,
  InitiateMultipartUploadInput,
  CompleteMultipartUploadInput,
} from '../inputs/media.inputs.js';
import type {
  PresignedUploadResponseData,
  MediaType,
  PaginatedMediaData,
  QuotaUsageType,
} from '../dto/media.types.js';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media)
    private readonly mediaRepo: Repository<Media>,
    @InjectRepository(MediaVersion)
    private readonly versionRepo: Repository<MediaVersion>,
    @InjectRepository(UploadSession)
    private readonly sessionRepo: Repository<UploadSession>,
    private readonly storage: S3StorageService,
    private readonly sseService: MediaSseService,
    private readonly quotaService: MediaQuotaService,
    private readonly validationService: MediaValidationService,
    private readonly configService: ConfigService,
  ) {}

  async requestUpload(
    userId: string,
    input: RequestUploadInput,
  ): Promise<PresignedUploadResponseData> {
    // 1. Quota & Limits
    await this.quotaService.checkCanUpload(userId, input.sizeBytes);

    // 2. MIME & Extension validation
    if (!this.validationService.validateDeclaredType(input.fileName, input.mimeType)) {
      throw new BadRequestException(`File extension does not match declared MIME type ${input.mimeType}`);
    }

    const isMultipart = input.sizeBytes > MEDIA_CONSTANTS.MULTIPART_THRESHOLD_BYTES;
    const bucket = this.storage.getDefaultBucket();

    // Prevent directory traversal or malformed characters in fileName
    const cleanFileName = input.fileName.split(/[/\\]/).pop() || 'file';
    const sanitizedFileName = cleanFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `uploads/${userId}/${Date.now()}_${sanitizedFileName}`;
    const mediaType = this.resolveCategory(input.mimeType);

    const media = this.mediaRepo.create({
      fileName: input.fileName,
      storageKey,
      mimeType: input.mimeType,
      mediaType,
      sizeBytes: input.sizeBytes.toString(),
      storageBucket: bucket,
      status: MediaStatus.PENDING,
      uploadedById: userId,
      checksum: null,
      isPublic: input.isPublic ?? false,
      metadata: {},
    });

    const saved = await this.mediaRepo.save(media);
    const expiresIn =
      this.configService.get<number>('MEDIA_PRESIGNED_EXPIRES_IN') ||
      MEDIA_CONSTANTS.DEFAULT_PRESIGNED_EXPIRES_SECONDS;

    if (!isMultipart) {
      const uploadUrl = await this.storage.getPresignedPutUrl(
        bucket,
        storageKey,
        input.mimeType,
        expiresIn,
      );

      this.sseService.emit({
        mediaId: saved.id,
        status: MediaStatus.PENDING,
        progressPercent: 0,
        message: 'Presigned upload URL generated',
        timestamp: new Date().toISOString(),
      });

      return {
        mediaId: saved.id,
        uploadUrl,
        storageKey,
        isMultipart: false,
        expiresInSeconds: expiresIn,
      };
    }

    return this.initiateMultipartInternal(saved, input.sizeBytes, expiresIn);
  }

  async initiateMultipartUpload(
    userId: string,
    input: InitiateMultipartUploadInput,
  ): Promise<PresignedUploadResponseData> {
    await this.quotaService.checkCanUpload(userId, input.sizeBytes);

    if (!this.validationService.validateDeclaredType(input.fileName, input.mimeType)) {
      throw new BadRequestException(`File extension does not match declared MIME type ${input.mimeType}`);
    }

    const bucket = this.storage.getDefaultBucket();
    const cleanFileName = input.fileName.split(/[/\\]/).pop() || 'file';
    const sanitizedFileName = cleanFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `uploads/${userId}/${Date.now()}_${sanitizedFileName}`;
    const mediaType = this.resolveCategory(input.mimeType);

    const media = this.mediaRepo.create({
      fileName: input.fileName,
      storageKey,
      mimeType: input.mimeType,
      mediaType,
      sizeBytes: input.sizeBytes.toString(),
      storageBucket: bucket,
      status: MediaStatus.UPLOADING,
      uploadedById: userId,
      checksum: null,
      isPublic: input.isPublic ?? false,
      metadata: {},
    });

    const saved = await this.mediaRepo.save(media);
    const expiresIn =
      this.configService.get<number>('MEDIA_PRESIGNED_EXPIRES_IN') ||
      MEDIA_CONSTANTS.DEFAULT_PRESIGNED_EXPIRES_SECONDS;

    return this.initiateMultipartInternal(
      saved,
      input.sizeBytes,
      expiresIn,
      input.partSizeBytes,
    );
  }

  private async initiateMultipartInternal(
    media: Media,
    totalBytes: number,
    expiresIn: number,
    customPartSize?: number,
  ): Promise<PresignedUploadResponseData> {
    const bucket = media.storageBucket;
    const uploadId = await this.storage.createMultipartUpload(
      bucket,
      media.storageKey,
      media.mimeType,
    );

    // Automatically compute partSize: Must satisfy S3 rule (max 10,000 parts) and min part size (5MB)
    const minPartSizeForFile = Math.ceil(totalBytes / MEDIA_CONSTANTS.MAX_PARTS_COUNT);
    const configuredPartSize = customPartSize || MEDIA_CONSTANTS.DEFAULT_PART_SIZE_BYTES;
    const partSize = Math.max(configuredPartSize, minPartSizeForFile, MEDIA_CONSTANTS.MIN_PART_SIZE_BYTES);
    const partsCount = Math.ceil(totalBytes / partSize);

    if (partsCount > MEDIA_CONSTANTS.MAX_PARTS_COUNT) {
      throw new BadRequestException(
        `File size requires more than ${MEDIA_CONSTANTS.MAX_PARTS_COUNT} parts with part size ${partSize}`,
      );
    }

    const parts: Array<{ partNumber: number; uploadUrl: string }> = [];
    for (let partNumber = 1; partNumber <= partsCount; partNumber++) {
      const uploadUrl = await this.storage.getPresignedUploadPartUrl(
        bucket,
        media.storageKey,
        uploadId,
        partNumber,
        expiresIn,
      );
      parts.push({ partNumber, uploadUrl });
    }

    this.transitionState(media, MediaStatus.UPLOADING);
    media.uploadId = uploadId;
    media.metadata = {
      ...media.metadata,
      partsCount,
    };
    await this.mediaRepo.save(media);

    // Save session record
    const session = this.sessionRepo.create({
      mediaId: media.id,
      userId: media.uploadedById,
      s3UploadId: uploadId,
      objectKey: media.storageKey,
      totalParts: partsCount,
      partSizeBytes: partSize.toString(),
      status: UploadSessionStatus.UPLOADING,
      completedParts: [],
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    });
    await this.sessionRepo.save(session);

    this.sseService.emit({
      mediaId: media.id,
      status: MediaStatus.UPLOADING,
      progressPercent: 0,
      totalBytes,
      message: `Multipart upload initiated with ${partsCount} parts`,
      timestamp: new Date().toISOString(),
    });

    return {
      mediaId: media.id,
      uploadId,
      s3UploadId: uploadId,
      parts,
      presignedParts: parts,
      partSize,
      totalParts: partsCount,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      storageKey: media.storageKey,
      isMultipart: true,
      expiresInSeconds: expiresIn,
    };
  }

  async completeMultipartUpload(
    userId: string,
    input: CompleteMultipartUploadInput,
  ): Promise<MediaType> {
    const media = await this.mediaRepo.findOne({
      where: { id: input.mediaId, uploadedById: userId },
    });

    if (!media) {
      throw new NotFoundException(`Media not found with ID ${input.mediaId}`);
    }

    if (!media.uploadId) {
      throw new BadRequestException(`Media ${input.mediaId} is not a multipart upload`);
    }

    const parts = input.parts.map((p) => ({
      PartNumber: p.partNumber,
      ETag: p.eTag,
    }));

    const result = await this.storage.completeMultipartUpload(
      media.storageBucket,
      media.storageKey,
      media.uploadId,
      parts,
    );

    // Object verification via HeadObject
    const isValid = await this.validationService.validateStorageObject(
      this.storage,
      media.storageBucket,
      media.storageKey,
      media.mimeType,
    );

    if (!isValid) {
      this.transitionState(media, MediaStatus.FAILED);
      await this.mediaRepo.save(media);
      throw new BadRequestException('Storage object integrity verification failed');
    }

    this.transitionState(media, MediaStatus.READY);
    media.metadata = {
      ...media.metadata,
      etag: result.eTag,
    };
    const saved = await this.mediaRepo.save(media);

    // Register original version rendition
    await this.registerVersion(saved, VersionType.ORIGINAL, saved.storageKey, saved.sizeBytes);

    // Update upload session
    await this.sessionRepo.update(
      { mediaId: media.id },
      { status: UploadSessionStatus.COMPLETED, completedParts: input.parts },
    );

    this.sseService.emit({
      mediaId: saved.id,
      status: MediaStatus.READY,
      progressPercent: 100,
      message: 'Upload completed and verified successfully',
      timestamp: new Date().toISOString(),
    });

    return this.mapToType(saved);
  }

  async verifyDirectUpload(userId: string, mediaId: string): Promise<MediaType> {
    const media = await this.mediaRepo.findOne({
      where: { id: mediaId, uploadedById: userId },
    });

    if (!media) {
      throw new NotFoundException(`Media not found with ID ${mediaId}`);
    }

    const isValid = await this.validationService.validateStorageObject(
      this.storage,
      media.storageBucket,
      media.storageKey,
      media.mimeType,
    );

    if (!isValid) {
      this.transitionState(media, MediaStatus.FAILED);
      await this.mediaRepo.save(media);
      throw new BadRequestException('Object not found or invalid on storage');
    }

    this.transitionState(media, MediaStatus.READY);
    const saved = await this.mediaRepo.save(media);

    await this.registerVersion(saved, VersionType.ORIGINAL, saved.storageKey, saved.sizeBytes);

    this.sseService.emit({
      mediaId: saved.id,
      status: MediaStatus.READY,
      progressPercent: 100,
      message: 'Single upload verified successfully',
      timestamp: new Date().toISOString(),
    });

    return this.mapToType(saved);
  }

  async abortMultipartUpload(userId: string, mediaId: string): Promise<void> {
    const media = await this.mediaRepo.findOne({
      where: { id: mediaId, uploadedById: userId },
    });

    if (!media) {
      throw new NotFoundException(`Media not found with ID ${mediaId}`);
    }

    if (media.uploadId) {
      await this.storage.abortMultipartUpload(
        media.storageBucket,
        media.storageKey,
        media.uploadId,
      );
    }

    this.transitionState(media, MediaStatus.ABORTED);
    await this.mediaRepo.save(media);

    await this.sessionRepo.update(
      { mediaId },
      { status: UploadSessionStatus.ABORTED },
    );

    this.sseService.emit({
      mediaId: media.id,
      status: MediaStatus.ABORTED,
      message: 'Upload aborted',
      timestamp: new Date().toISOString(),
    });
  }

  async getDownloadUrl(
    userId: string,
    mediaId: string,
  ): Promise<{ downloadUrl: string; expiresInSeconds: number }> {
    const media = await this.mediaRepo.findOne({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException(`Media not found with ID ${mediaId}`);
    }

    if (!media.isPublic && media.uploadedById !== userId) {
      throw new NotFoundException(`Media not found or unauthorized`);
    }

    const expiresIn =
      this.configService.get<number>('MEDIA_PRESIGNED_EXPIRES_IN') ||
      MEDIA_CONSTANTS.DEFAULT_PRESIGNED_EXPIRES_SECONDS;

    const downloadUrl = await this.storage.getPresignedGetUrl(
      media.storageBucket,
      media.storageKey,
      expiresIn,
    );

    return {
      downloadUrl,
      expiresInSeconds: expiresIn,
    };
  }

  async findById(mediaId: string): Promise<MediaType> {
    const media = await this.mediaRepo.findOne({ where: { id: mediaId } });
    if (!media) {
      throw new NotFoundException(`Media not found with ID ${mediaId}`);
    }
    return this.mapToType(media);
  }

  async paginate(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedMediaData> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await this.mediaRepo.findAndCount({
      where: { uploadedById: userId },
      order: { createdAt: 'DESC' },
      skip,
      take: safeLimit,
    });

    return {
      items: items.map((m) => this.mapToType(m)),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  async getUserQuota(userId: string): Promise<QuotaUsageType> {
    const usage = await this.quotaService.getQuotaUsage(userId);
    return {
      userId: usage.userId,
      usedBytes: usage.usedBytes.toString(),
      quotaBytes: usage.quotaBytes.toString(),
      activeUploads: usage.activeUploads,
      maxConcurrent: usage.maxConcurrent,
    };
  }

  async delete(userId: string, mediaId: string): Promise<void> {
    const media = await this.mediaRepo.findOne({
      where: { id: mediaId, uploadedById: userId },
    });

    if (!media) {
      throw new NotFoundException(`Media not found with ID ${mediaId}`);
    }

    await this.storage.deleteObject(media.storageBucket, media.storageKey);
    this.transitionState(media, MediaStatus.DELETED);
    await this.mediaRepo.save(media);
    await this.mediaRepo.softDelete(media.id);
  }

  private transitionState(media: Media, next: MediaStatus): void {
    const allowed = ALLOWED_STATUS_TRANSITIONS[media.status] || [];
    if (!allowed.includes(next) && media.status !== next) {
      throw new BadRequestException(
        `Invalid status transition from ${media.status} to ${next}`,
      );
    }
    media.status = next;
  }

  private async registerVersion(
    media: Media,
    versionType: VersionType,
    storageKey: string,
    sizeBytes: string,
  ): Promise<void> {
    const version = this.versionRepo.create({
      mediaId: media.id,
      versionType,
      storageKey,
      mimeType: media.mimeType,
      sizeBytes,
    });
    await this.versionRepo.save(version);
  }

  private resolveCategory(mime: string): MediaTypeCategory {
    if (mime.startsWith('image/')) return MediaTypeCategory.IMAGE;
    if (mime.startsWith('video/')) return MediaTypeCategory.VIDEO;
    if (mime.startsWith('audio/')) return MediaTypeCategory.AUDIO;
    if (mime.includes('pdf') || mime.includes('document') || mime.includes('text')) {
      return MediaTypeCategory.DOCUMENT;
    }
    if (mime.includes('zip') || mime.includes('tar') || mime.includes('archive')) {
      return MediaTypeCategory.ARCHIVE;
    }
    return MediaTypeCategory.OTHER;
  }

  private mapToType(entity: Media): MediaType {
    return {
      id: entity.id,
      fileName: entity.fileName,
      storageKey: entity.storageKey,
      mimeType: entity.mimeType,
      mediaType: entity.mediaType,
      sizeBytes: entity.sizeBytes,
      status: entity.status,
      uploadedById: entity.uploadedById,
      checksum: entity.checksum,
      isPublic: entity.isPublic,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
