import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Media } from '../entities/media.entity.js';
import { MediaVersion } from '../entities/media-version.entity.js';
import {
  UploadSession,
} from '../entities/upload-session.entity.js';
import { UploadSessionStatus } from '../enums/upload-session.enum.js';
import { MediaJob } from '../entities/media-job.entity.js';
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
  MIME_TO_CATEGORY_MAP,
  MIME_KEYWORD_MAP,
} from '../constants/media.constants.js';
import type {
  RequestUploadInput,
  InitiateMultipartUploadInput,
  CompleteMultipartUploadInput,
  CreateUploadSessionInput,
  CompleteUploadInput,
  UpdateMediaInput,
  MediaListFilterInput,
} from '../input/media.inputs.js';
import type {
  PresignedUploadResponseData,
  MediaType,
  PaginatedMediaData,
  QuotaUsageType,
  UploadStatusData,
  DownloadUrlData,
  MediaVersionType,
  MediaJobObjectType,
} from '../dto/media.types.js';
import type { IPresignedPart } from '../interfaces/IMediaMetadata.interface.js';
import { MediaWorkerService } from './media-worker.service.js';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepo: Repository<Media>,
    @InjectRepository(MediaVersion)
    private readonly versionRepo: Repository<MediaVersion>,
    @InjectRepository(UploadSession)
    private readonly sessionRepo: Repository<UploadSession>,
    @InjectRepository(MediaJob)
    private readonly jobRepo: Repository<MediaJob>,
    private readonly storage: S3StorageService,
    private readonly sseService: MediaSseService,
    private readonly quotaService: MediaQuotaService,
    private readonly validationService: MediaValidationService,
    private readonly configService: ConfigService,
    private readonly workerService: MediaWorkerService,
  ) {}

  async requestUpload(
    userId: string,
    input: RequestUploadInput,
  ): Promise<PresignedUploadResponseData> {
    const start = Date.now();
    this.logger.log(`Requesting upload for user ${userId}, file: ${input.fileName}`);
    // 1. Quota & Limits
    await this.quotaService.checkCanUpload(userId, input.sizeBytes);

    // 2. MIME & Extension validation
    if (
      !this.validationService.validateDeclaredType(
        input.fileName,
        input.mimeType,
      )
    ) {
      throw new BadRequestException(
        `File extension does not match declared MIME type ${input.mimeType}`,
      );
    }

    const isMultipart =
      input.sizeBytes > MEDIA_CONSTANTS.MULTIPART_THRESHOLD_BYTES;
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
      tags: [],
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

      this.logger.debug(`requestUpload completed in ${Date.now() - start}ms`);
      return {
        mediaId: saved.id,
        uploadUrl,
        storageKey,
        isMultipart: false,
        expiresInSeconds: expiresIn,
      };
    }

    const result = await this.initiateMultipartInternal(saved, input.sizeBytes, expiresIn);
    this.logger.debug(`requestUpload completed in ${Date.now() - start}ms`);
    return result;
  }

  async initiateMultipartUpload(
    userId: string,
    input: InitiateMultipartUploadInput,
  ): Promise<PresignedUploadResponseData> {
    const start = Date.now();
    this.logger.log(`Initiating multipart upload for user ${userId}, file: ${input.fileName}`);
    await this.quotaService.checkCanUpload(userId, input.sizeBytes);

    if (
      !this.validationService.validateDeclaredType(
        input.fileName,
        input.mimeType,
      )
    ) {
      throw new BadRequestException(
        `File extension does not match declared MIME type ${input.mimeType}`,
      );
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
      tags: [],
      metadata: {},
    });

    const saved = await this.mediaRepo.save(media);
    const expiresIn =
      this.configService.get<number>('MEDIA_PRESIGNED_EXPIRES_IN') ||
      MEDIA_CONSTANTS.DEFAULT_PRESIGNED_EXPIRES_SECONDS;

    const result = await this.initiateMultipartInternal(
      saved,
      input.sizeBytes,
      expiresIn,
      input.partSizeBytes,
    );
    this.logger.debug(`initiateMultipartUpload completed in ${Date.now() - start}ms`);
    return result;
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

    const minPartSizeForFile = Math.ceil(
      totalBytes / MEDIA_CONSTANTS.MAX_PARTS_COUNT,
    );
    const configuredPartSize =
      customPartSize || MEDIA_CONSTANTS.DEFAULT_PART_SIZE_BYTES;
    const partSize = Math.max(
      configuredPartSize,
      minPartSizeForFile,
      MEDIA_CONSTANTS.MIN_PART_SIZE_BYTES,
    );
    const partsCount = Math.ceil(totalBytes / partSize);

    if (partsCount > MEDIA_CONSTANTS.MAX_PARTS_COUNT) {
      throw new BadRequestException(
        `File size requires more than ${MEDIA_CONSTANTS.MAX_PARTS_COUNT} parts with part size ${partSize}`,
      );
    }

    const parts: IPresignedPart[] = [];
    for (let partNumber = 1; partNumber <= partsCount; partNumber++) {
      const uploadUrl = await this.storage.getPresignedUploadPartUrl(
        bucket,
        media.storageKey,
        uploadId,
        partNumber,
        expiresIn,
      );
      parts.push({ partNumber, uploadUrl, presignedUrl: uploadUrl });
    }

    this.transitionState(media, MediaStatus.UPLOADING);
    media.uploadId = uploadId;
    media.metadata = {
      ...media.metadata,
      partsCount,
    };
    await this.mediaRepo.save(media);

    const session = this.sessionRepo.create({
      mediaId: media.id,
      userId: media.uploadedById ?? undefined,
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
      parts,
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
    const start = Date.now();
    this.logger.log(`Completing multipart upload for media ${input.mediaId}`);
    const media = await this.mediaRepo.findOne({
      where: { id: input.mediaId, uploadedById: userId },
    });

    if (!media) {
      throw new NotFoundException(`Media not found with ID ${input.mediaId}`);
    }

    if (!media.uploadId) {
      throw new BadRequestException(
        `Media ${input.mediaId} is not a multipart upload`,
      );
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

    const isValid = await this.validationService.validateStorageObject(
      this.storage,
      media.storageBucket,
      media.storageKey,
      media.mimeType,
    );

    if (!isValid) {
      this.transitionState(media, MediaStatus.FAILED);
      await this.mediaRepo.save(media);
      throw new BadRequestException(
        'Storage object integrity verification failed',
      );
    }

    this.transitionState(media, MediaStatus.READY);
    media.metadata = {
      ...media.metadata,
      etag: result.eTag,
    };
    const saved = await this.mediaRepo.save(media);

    await this.registerVersion(
      saved,
      VersionType.ORIGINAL,
      saved.storageKey,
      saved.sizeBytes,
    );

    await this.sessionRepo.update(
      { mediaId: media.id },
      { status: UploadSessionStatus.COMPLETED, completedParts: input.parts },
    );

    await this.quotaService.invalidateQuotaCache(userId);

    await this.workerService
      .dispatchProcessingJob({
        mediaId: saved.id,
        storageKey: saved.storageKey,
        bucket: saved.storageBucket,
        mimeType: saved.mimeType,
        userId,
      })
      .catch((err: unknown) => {
        this.logger.warn(`Failed to dispatch background job: ${String(err)}`);
      });

    this.sseService.emit({
      mediaId: saved.id,
      status: MediaStatus.READY,
      progressPercent: 100,
      message: 'Upload completed and verified successfully',
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`completeMultipartUpload finished in ${Date.now() - start}ms`);
    return this.mapToType(saved);
  }

  async verifyDirectUpload(
    userId: string,
    mediaId: string,
  ): Promise<MediaType> {
    const start = Date.now();
    this.logger.log(`Verifying direct upload for media ${mediaId}`);
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

    await this.registerVersion(
      saved,
      VersionType.ORIGINAL,
      saved.storageKey,
      saved.sizeBytes,
    );

    await this.quotaService.invalidateQuotaCache(userId);

    this.sseService.emit({
      mediaId: saved.id,
      status: MediaStatus.READY,
      progressPercent: 100,
      message: 'Single upload verified successfully',
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`verifyDirectUpload finished in ${Date.now() - start}ms`);
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
    versionType?: string,
    expirySeconds?: number,
  ): Promise<DownloadUrlData> {
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
      expirySeconds ||
      this.configService.get<number>('MEDIA_PRESIGNED_EXPIRES_IN') ||
      MEDIA_CONSTANTS.DEFAULT_PRESIGNED_EXPIRES_SECONDS;

    let targetKey = media.storageKey;
    if (versionType && versionType !== VersionType.ORIGINAL) {
      const rendition = await this.versionRepo.findOne({
        where: { mediaId: media.id, versionType: versionType as VersionType },
      });
      if (rendition) {
        targetKey = rendition.storageKey;
      }
    }

    const downloadUrl = await this.storage.getPresignedGetUrl(
      media.storageBucket,
      targetKey,
      expiresIn,
    );

    return {
      mediaId,
      downloadUrl,
      expiresInSeconds: expiresIn,
      expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
      contentType: media.mimeType,
    };
  }

  async getUploadStatus(
    userId: string,
    uploadId: string,
  ): Promise<UploadStatusData> {
    const session = await this.sessionRepo.findOne({
      where: { s3UploadId: uploadId, userId },
    });

    if (!session) {
      throw new NotFoundException(
        `Upload session not found for upload ID ${uploadId}`,
      );
    }

    const completedPartNumbers = new Set(
      (session.completedParts || []).map((p) => p.partNumber),
    );

    const missingParts: number[] = [];
    for (let i = 1; i <= session.totalParts; i++) {
      if (!completedPartNumbers.has(i)) {
        missingParts.push(i);
      }
    }

    return {
      uploadId,
      status: session.status,
      totalParts: session.totalParts,
      completedParts: completedPartNumbers.size,
      missingParts,
      expiresAt: Math.floor(session.expiresAt.getTime() / 1000),
    };
  }

  async abortUploadByUploadId(userId: string, uploadId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { s3UploadId: uploadId, userId },
    });

    if (!session) {
      throw new NotFoundException(
        `Upload session not found for upload ID ${uploadId}`,
      );
    }

    await this.abortMultipartUpload(userId, session.mediaId);
  }

  async completeUploadByUploadId(
    userId: string,
    input: CompleteUploadInput,
  ): Promise<{ mediaId: string; status: MediaStatus }> {
    const session = await this.sessionRepo.findOne({
      where: { s3UploadId: input.uploadId, userId },
    });

    if (!session) {
      throw new NotFoundException(
        `Upload session not found for upload ID ${input.uploadId}`,
      );
    }

    const media = await this.completeMultipartUpload(userId, {
      mediaId: session.mediaId,
      parts: input.parts,
    });

    return {
      mediaId: media.id,
      status: media.status,
    };
  }

  async createUploadSession(
    userId: string,
    input: CreateUploadSessionInput,
  ): Promise<PresignedUploadResponseData> {
    return this.initiateMultipartUpload(userId, {
      fileName: input.fileName,
      mimeType: input.contentType,
      sizeBytes: input.size,
      isPublic: false,
    });
  }

  async findById(mediaId: string): Promise<MediaType> {
    const media = await this.mediaRepo.findOne({ where: { id: mediaId } });
    if (!media) {
      throw new NotFoundException(`Media not found with ID ${mediaId}`);
    }
    return this.mapToType(media);
  }

  async updateMedia(
    userId: string,
    input: UpdateMediaInput,
  ): Promise<MediaType> {
    const media = await this.mediaRepo.findOne({
      where: { id: input.mediaId, uploadedById: userId },
    });

    if (!media) {
      throw new NotFoundException(`Media not found with ID ${input.mediaId}`);
    }

    if (input.fileName !== undefined) {
      media.fileName = input.fileName;
    }
    if (input.isPublic !== undefined) {
      media.isPublic = input.isPublic;
    }
    if (input.tags !== undefined) {
      media.tags = input.tags;
    }

    const saved = await this.mediaRepo.save(media);
    return this.mapToType(saved);
  }

  async listVersions(mediaId: string, userId: string): Promise<MediaVersionType[]> {
    const media = await this.mediaRepo.findOne({ where: { id: mediaId } });
    if (!media) {
      throw new NotFoundException(`Media not found with ID ${mediaId}`);
    }
    if (!media.isPublic && media.uploadedById !== userId) {
      throw new NotFoundException(`Media not found or unauthorized`);
    }

    const versions = await this.versionRepo.find({
      where: { mediaId },
      order: { createdAt: 'ASC' },
    });

    return versions.map((v) => ({
      id: v.id,
      mediaId: v.mediaId,
      versionType: v.versionType,
      storageKey: v.storageKey,
      mimeType: v.mimeType,
      sizeBytes: v.sizeBytes,
      width: v.width,
      height: v.height,
      durationSeconds: v.durationSeconds,
    }));
  }

  async listJobs(mediaId: string, userId: string): Promise<MediaJobObjectType[]> {
    const media = await this.mediaRepo.findOne({
      where: { id: mediaId, uploadedById: userId },
    });
    if (!media) {
      throw new NotFoundException(`Media not found with ID ${mediaId}`);
    }

    const jobs = await this.jobRepo.find({
      where: { mediaId },
      order: { createdAt: 'DESC' },
    });

    return jobs.map((j) => ({
      id: j.id,
      mediaId: j.mediaId,
      jobType: j.jobType,
      status: j.status,
      attempts: j.attempts,
      maxAttempts: j.maxAttempts,
      lastError: j.lastError,
      startedAt: j.startedAt?.toISOString() ?? null,
      completedAt: j.completedAt?.toISOString() ?? null,
      createdAt: j.createdAt.toISOString(),
    }));
  }

  async paginate(
    userId: string,
    page: number = 1,
    limit: number = 10,
    filter?: MediaListFilterInput,
  ): Promise<PaginatedMediaData> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const query = this.mediaRepo
      .createQueryBuilder('media')
      .where('media.uploaded_by_id = :userId', { userId });

    if (filter?.mediaType) {
      query.andWhere('media.media_type = :mediaType', { mediaType: filter.mediaType });
    }
    if (filter?.status) {
      query.andWhere('media.status = :status', { status: filter.status });
    }
    if (filter?.fromDate) {
      query.andWhere('media.created_at >= :fromDate', { fromDate: filter.fromDate });
    }
    if (filter?.toDate) {
      query.andWhere('media.created_at <= :toDate', { toDate: filter.toDate });
    }

    query.orderBy('media.created_at', 'DESC').skip(skip).take(safeLimit);

    const [items, total] = await query.getManyAndCount();

    return {
      items: items.map((m) => this.mapToType(m)),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  async adminListMedia(
    page: number = 1,
    limit: number = 10,
    filter?: MediaListFilterInput,
  ): Promise<PaginatedMediaData> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const query = this.mediaRepo.createQueryBuilder('media');

    if (filter?.mediaType) {
      query.andWhere('media.media_type = :mediaType', { mediaType: filter.mediaType });
    }
    if (filter?.status) {
      query.andWhere('media.status = :status', { status: filter.status });
    }
    if (filter?.fromDate) {
      query.andWhere('media.created_at >= :fromDate', { fromDate: filter.fromDate });
    }
    if (filter?.toDate) {
      query.andWhere('media.created_at <= :toDate', { toDate: filter.toDate });
    }

    query.orderBy('media.created_at', 'DESC').skip(skip).take(safeLimit);

    const [items, total] = await query.getManyAndCount();

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
    await this.mediaRepo.softDelete(media.id);
    await this.quotaService.invalidateQuotaCache(userId);
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
    const lower = mime.toLowerCase();
    for (const rule of MIME_TO_CATEGORY_MAP) {
      if (lower.startsWith(rule.prefix)) {
        return rule.category;
      }
    }
    for (const rule of MIME_KEYWORD_MAP) {
      if (lower.includes(rule.keyword)) {
        return rule.category;
      }
    }
    return MediaTypeCategory.OTHER;
  }

  private mapToType(entity: Media): MediaType {
    return {
      id: entity.id,
      mediaId: entity.id,
      fileName: entity.fileName,
      storageKey: entity.storageKey,
      mimeType: entity.mimeType,
      mediaType: entity.mediaType,
      sizeBytes: entity.sizeBytes,
      status: entity.status,
      uploadedById: entity.uploadedById || '',
      checksum: entity.checksum,
      isPublic: entity.isPublic,
      tags: entity.tags || [],
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
