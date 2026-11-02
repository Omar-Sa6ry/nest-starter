import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MediaService } from './media.service.js';
import { S3StorageService } from './s3-storage.service.js';
import { MediaSseService } from './media-sse.service.js';
import { MediaQuotaService } from './media-quota.service.js';
import { MediaValidationService } from './media-validation.service.js';
import { MediaWorkerService } from './media-worker.service.js';
import {
  MediaStatus,
  MediaTypeCategory,
  VersionType,
} from '../constants/media.constants.js';
import { UploadSessionStatus } from '../entities/upload-session.entity.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import type { Media } from '../entities/media.entity.js';
import type { MediaVersion } from '../entities/media-version.entity.js';
import type { UploadSession } from '../entities/upload-session.entity.js';

describe('MediaService (Enterprise Starter)', () => {
  let service: MediaService;
  let mockMediaRepo: Partial<Repository<Media>>;
  let mockVersionRepo: Partial<Repository<MediaVersion>>;
  let mockSessionRepo: Partial<Repository<UploadSession>>;
  let mockStorage: Partial<S3StorageService>;
  let mockSse: Partial<MediaSseService>;
  let mockQuota: Partial<MediaQuotaService>;
  let mockValidation: Partial<MediaValidationService>;
  let mockConfig: Partial<ConfigService>;
  let mockWorker: Partial<MediaWorkerService>;

  beforeEach(() => {
    mockMediaRepo = {
      create: vi
        .fn()
        .mockImplementation((dto) => ({ id: 'media-snowflake-1', ...dto })),
      save: vi
        .fn()
        .mockImplementation((entity) =>
          Promise.resolve({ id: 'media-snowflake-1', ...entity }),
        ),
      findOne: vi.fn(),
      findAndCount: vi.fn(),
      softDelete: vi.fn().mockResolvedValue({ affected: 1 } as never),
    };

    mockVersionRepo = {
      create: vi.fn().mockImplementation((dto) => ({ id: 'ver-1', ...dto })),
      save: vi.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: vi.fn(),
    };

    mockSessionRepo = {
      create: vi.fn().mockImplementation((dto) => ({ id: 'sess-1', ...dto })),
      save: vi.fn().mockImplementation((entity) => Promise.resolve(entity)),
      update: vi.fn().mockResolvedValue({ affected: 1 } as never),
      findOne: vi.fn(),
    };

    mockStorage = {
      getDefaultBucket: vi.fn().mockReturnValue('test-media-bucket'),
      getPresignedPutUrl: vi
        .fn()
        .mockResolvedValue(
          'https://s3.amazonaws.com/test-media-bucket/presigned-put',
        ),
      getPresignedGetUrl: vi
        .fn()
        .mockResolvedValue(
          'https://s3.amazonaws.com/test-media-bucket/presigned-get',
        ),
      createMultipartUpload: vi.fn().mockResolvedValue('upload-id-123'),
      getPresignedUploadPartUrl: vi
        .fn()
        .mockResolvedValue('https://s3.amazonaws.com/test-media-bucket/part-1'),
      completeMultipartUpload: vi
        .fn()
        .mockResolvedValue({ location: 's3://bucket/key', eTag: 'etag-123' }),
      abortMultipartUpload: vi.fn().mockResolvedValue(undefined),
      headObject: vi.fn().mockResolvedValue({
        contentLength: 1024,
        contentType: 'image/png',
        eTag: 'etag-123',
      }),
      deleteObject: vi.fn().mockResolvedValue(undefined),
    };

    mockSse = {
      emit: vi.fn(),
    };

    mockQuota = {
      checkCanUpload: vi.fn().mockResolvedValue(undefined),
      getQuotaUsage: vi.fn().mockResolvedValue({
        userId: 'user-1',
        usedBytes: 1000,
        quotaBytes: 50 * 1024 * 1024 * 1024,
        activeUploads: 0,
        maxConcurrent: 5,
      }),
    };

    mockValidation = {
      validateDeclaredType: vi.fn().mockReturnValue(true),
      validateStorageObject: vi.fn().mockResolvedValue(true),
    };

    mockConfig = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'MEDIA_PRESIGNED_EXPIRES_IN') return 3600;
        return undefined;
      }),
    };

    mockWorker = {
      dispatchProcessingJob: vi.fn().mockResolvedValue(undefined),
    };

    service = new MediaService(
      mockMediaRepo as Repository<Media>,
      mockVersionRepo as Repository<MediaVersion>,
      mockSessionRepo as Repository<UploadSession>,
      mockStorage as S3StorageService,
      mockSse as MediaSseService,
      mockQuota as MediaQuotaService,
      mockValidation as MediaValidationService,
      mockConfig as ConfigService,
      mockWorker as MediaWorkerService,
    );
  });

  describe('requestUpload', () => {
    it('should generate direct presigned put URL for small files (<50MB)', async () => {
      const res = await service.requestUpload('user-1', {
        fileName: 'test-image.png',
        mimeType: 'image/png',
        sizeBytes: 1024 * 1024,
      });

      expect(res.isMultipart).toBe(false);
      expect(res.uploadUrl).toContain('presigned-put');
      expect(mockStorage.getPresignedPutUrl).toHaveBeenCalledTimes(1);
      expect(mockQuota.checkCanUpload).toHaveBeenCalledWith(
        'user-1',
        1024 * 1024,
      );
      expect(mockSse.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MediaStatus.PENDING,
          message: 'Presigned upload URL generated',
        }),
      );
    });

    it('should initiate multipart upload session for large files (>50MB)', async () => {
      const res = await service.requestUpload('user-1', {
        fileName: 'large-video.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 100 * 1024 * 1024,
      });

      expect(res.isMultipart).toBe(true);
      expect(res.uploadId).toBe('upload-id-123');
      expect(res.parts?.length).toBe(10);
      expect(mockSessionRepo.save).toHaveBeenCalledTimes(1);
      expect(mockSse.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MediaStatus.UPLOADING,
          totalBytes: 100 * 1024 * 1024,
        }),
      );
    });

    it('should throw BadRequestException if validation fails', async () => {
      vi.mocked(mockValidation.validateDeclaredType!).mockReturnValue(false);

      await expect(
        service.requestUpload('user-1', {
          fileName: 'malicious.exe',
          mimeType: 'image/png',
          sizeBytes: 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should sanitize filename correctly and resolve different categories', async () => {
      const resDoc = await service.requestUpload('user-1', {
        fileName: 'folder/sub/doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        isPublic: true,
      });
      expect(resDoc.storageKey).toMatch(/uploads\/user-1\/\d+_doc\.pdf/);

      const resAudio = await service.requestUpload('user-1', {
        fileName: 'song.mp3',
        mimeType: 'audio/mpeg',
        sizeBytes: 2048,
      });
      expect(resAudio.mediaId).toBeDefined();

      const resArchive = await service.requestUpload('user-1', {
        fileName: 'backup.zip',
        mimeType: 'application/zip',
        sizeBytes: 2048,
      });
      expect(resArchive.mediaId).toBeDefined();

      const resOther = await service.requestUpload('user-1', {
        fileName: 'file.bin',
        mimeType: 'application/octet-stream',
        sizeBytes: 2048,
      });
      expect(resOther.mediaId).toBeDefined();
    });
  });

  describe('initiateMultipartUpload', () => {
    it('should initiate multipart upload explicitly with custom part size', async () => {
      const res = await service.initiateMultipartUpload('user-1', {
        fileName: 'archive.zip',
        mimeType: 'application/zip',
        sizeBytes: 30 * 1024 * 1024,
        partSizeBytes: 10 * 1024 * 1024,
      });

      expect(res.isMultipart).toBe(true);
      expect(res.parts?.length).toBe(3);
    });

    it('should throw BadRequestException if file validation fails in multipart', async () => {
      vi.mocked(mockValidation.validateDeclaredType!).mockReturnValue(false);

      await expect(
        service.initiateMultipartUpload('user-1', {
          fileName: 'fake.png',
          mimeType: 'video/mp4',
          sizeBytes: 60 * 1024 * 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeMultipartUpload', () => {
    it('should complete multipart upload, verify object and register version', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'media-snowflake-1',
        uploadedById: 'user-1',
        uploadId: 'upload-id-123',
        storageBucket: 'test-media-bucket',
        storageKey: 'uploads/user-1/key.mp4',
        fileName: 'large-video.mp4',
        mimeType: 'video/mp4',
        mediaType: MediaTypeCategory.VIDEO,
        sizeBytes: '104857600',
        status: MediaStatus.UPLOADING,
        isPublic: false,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.completeMultipartUpload('user-1', {
        mediaId: 'media-snowflake-1',
        parts: [{ partNumber: 1, eTag: 'etag-1' }],
      });

      expect(res.status).toBe(MediaStatus.READY);
      expect(mockStorage.completeMultipartUpload).toHaveBeenCalledTimes(1);
      expect(mockVersionRepo.save).toHaveBeenCalledTimes(1);
      expect(mockWorker.dispatchProcessingJob).toHaveBeenCalledTimes(1);
      expect(mockSse.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MediaStatus.READY,
          progressPercent: 100,
        }),
      );
    });

    it('should throw NotFoundException if media does not exist or user mismatch', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await expect(
        service.completeMultipartUpload('user-1', {
          mediaId: 'non-existent',
          parts: [{ partNumber: 1, eTag: 'etag-1' }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if media is not a multipart upload (missing uploadId)', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'media-snowflake-1',
        uploadedById: 'user-1',
        uploadId: null,
      });

      await expect(
        service.completeMultipartUpload('user-1', {
          mediaId: 'media-snowflake-1',
          parts: [{ partNumber: 1, eTag: 'etag-1' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark media as FAILED and throw if storage validation fails', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'media-snowflake-1',
        uploadedById: 'user-1',
        uploadId: 'upload-id-123',
        storageBucket: 'test-media-bucket',
        storageKey: 'uploads/user-1/key.mp4',
        mimeType: 'video/mp4',
        status: MediaStatus.UPLOADING,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(mockValidation.validateStorageObject!).mockResolvedValue(false);

      await expect(
        service.completeMultipartUpload('user-1', {
          mediaId: 'media-snowflake-1',
          parts: [{ partNumber: 1, eTag: 'etag-1' }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockMediaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: MediaStatus.FAILED }),
      );
    });

    it('should handle worker service failure gracefully during multipart complete', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'media-snowflake-1',
        uploadedById: 'user-1',
        uploadId: 'upload-id-123',
        storageBucket: 'test-media-bucket',
        storageKey: 'uploads/user-1/key.mp4',
        mimeType: 'video/mp4',
        status: MediaStatus.UPLOADING,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(mockValidation.validateStorageObject!).mockResolvedValue(true);
      vi.mocked(mockWorker.dispatchProcessingJob!).mockRejectedValue(
        new Error('BullMQ offline'),
      );

      const res = await service.completeMultipartUpload('user-1', {
        mediaId: 'media-snowflake-1',
        parts: [{ partNumber: 1, eTag: 'etag-1' }],
      });

      expect(res.status).toBe(MediaStatus.READY);
    });
  });

  describe('verifyDirectUpload', () => {
    it('should verify direct single-file upload successfully', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'media-direct-1',
        uploadedById: 'user-1',
        storageBucket: 'test-media-bucket',
        storageKey: 'uploads/user-1/image.png',
        mimeType: 'image/png',
        status: MediaStatus.PENDING,
        sizeBytes: '1024',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(mockValidation.validateStorageObject!).mockResolvedValue(true);

      const res = await service.verifyDirectUpload('user-1', 'media-direct-1');

      expect(res.status).toBe(MediaStatus.READY);
      expect(mockVersionRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException if media not found in verifyDirectUpload', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await expect(
        service.verifyDirectUpload('user-1', 'media-direct-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should mark media as FAILED and throw if direct upload object invalid', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'media-direct-1',
        uploadedById: 'user-1',
        storageBucket: 'test-media-bucket',
        storageKey: 'uploads/user-1/image.png',
        mimeType: 'image/png',
        status: MediaStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(mockValidation.validateStorageObject!).mockResolvedValue(false);

      await expect(
        service.verifyDirectUpload('user-1', 'media-direct-1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockMediaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: MediaStatus.FAILED }),
      );
    });
  });

  describe('abortMultipartUpload & abortUploadByUploadId', () => {
    it('should abort multipart upload and update state to ABORTED', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'media-snowflake-1',
        uploadedById: 'user-1',
        uploadId: 'upload-id-123',
        storageBucket: 'test-media-bucket',
        storageKey: 'uploads/user-1/file.mp4',
        status: MediaStatus.UPLOADING,
      });

      await service.abortMultipartUpload('user-1', 'media-snowflake-1');

      expect(mockStorage.abortMultipartUpload).toHaveBeenCalledWith(
        'test-media-bucket',
        'uploads/user-1/file.mp4',
        'upload-id-123',
      );
      expect(mockSessionRepo.update).toHaveBeenCalledWith(
        { mediaId: 'media-snowflake-1' },
        { status: UploadSessionStatus.ABORTED },
      );
    });

    it('should throw NotFoundException if media not found during abort', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await expect(
        service.abortMultipartUpload('user-1', 'missing-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should abort by upload ID', async () => {
      (mockSessionRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        mediaId: 'media-snowflake-1',
        s3UploadId: 'upload-id-123',
        userId: 'user-1',
      });
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'media-snowflake-1',
        uploadedById: 'user-1',
        uploadId: 'upload-id-123',
        storageBucket: 'test-media-bucket',
        storageKey: 'uploads/user-1/file.mp4',
        status: MediaStatus.UPLOADING,
      });

      await service.abortUploadByUploadId('user-1', 'upload-id-123');

      expect(mockSessionRepo.update).toHaveBeenCalledWith(
        { mediaId: 'media-snowflake-1' },
        { status: UploadSessionStatus.ABORTED },
      );
    });

    it('should throw NotFoundException if upload session not found during abortUploadByUploadId', async () => {
      (mockSessionRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await expect(
        service.abortUploadByUploadId('user-1', 'unknown-upload-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDownloadUrl', () => {
    it('should generate download url for authorized owner', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'media-1',
        uploadedById: 'user-1',
        isPublic: false,
        storageBucket: 'test-media-bucket',
        storageKey: 'uploads/user-1/file.png',
        mimeType: 'image/png',
      });

      const res = await service.getDownloadUrl('user-1', 'media-1');

      expect(res.downloadUrl).toContain('presigned-get');
      expect(mockStorage.getPresignedGetUrl).toHaveBeenCalledTimes(1);
    });

    it('should generate download url for public media even if requestor is different user', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'media-1',
        uploadedById: 'user-1',
        isPublic: true,
        storageBucket: 'test-media-bucket',
        storageKey: 'uploads/user-1/file.png',
        mimeType: 'image/png',
      });

      const res = await service.getDownloadUrl('other-user', 'media-1');

      expect(res.downloadUrl).toBeDefined();
    });

    it('should throw NotFoundException if media is private and requestor is different', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'media-1',
        uploadedById: 'user-1',
        isPublic: false,
      });

      await expect(
        service.getDownloadUrl('other-user', 'media-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if media does not exist', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await expect(
        service.getDownloadUrl('user-1', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use rendition storageKey when versionType is provided and found', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'media-1',
        uploadedById: 'user-1',
        isPublic: true,
        storageBucket: 'test-media-bucket',
        storageKey: 'uploads/user-1/file.png',
        mimeType: 'image/png',
      });
      (mockVersionRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        mediaId: 'media-1',
        versionType: VersionType.THUMBNAIL,
        storageKey: 'uploads/user-1/thumbnails/file.png',
      });

      await service.getDownloadUrl(
        'user-1',
        'media-1',
        VersionType.THUMBNAIL,
        1800,
      );

      expect(mockStorage.getPresignedGetUrl).toHaveBeenCalledWith(
        'test-media-bucket',
        'uploads/user-1/thumbnails/file.png',
        1800,
      );
    });
  });

  describe('upload session methods (getUploadStatus, completeUploadByUploadId, createUploadSession)', () => {
    it('should retrieve upload status with missing and completed parts', async () => {
      (mockSessionRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        s3UploadId: 'sess-upload-1',
        userId: 'user-1',
        status: UploadSessionStatus.UPLOADING,
        totalParts: 4,
        completedParts: [
          { partNumber: 1, eTag: 'etag-1' },
          { partNumber: 3, eTag: 'etag-3' },
        ],
        expiresAt: new Date(Date.now() + 60000),
      });

      const res = await service.getUploadStatus('user-1', 'sess-upload-1');

      expect(res.totalParts).toBe(4);
      expect(res.completedParts).toBe(2);
      expect(res.missingParts).toEqual([2, 4]);
    });

    it('should throw NotFoundException in getUploadStatus if session not found', async () => {
      (mockSessionRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await expect(
        service.getUploadStatus('user-1', 'sess-not-found'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should complete upload by uploadId', async () => {
      (mockSessionRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        s3UploadId: 'sess-upload-1',
        userId: 'user-1',
        mediaId: 'media-snowflake-1',
      });
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'media-snowflake-1',
        uploadedById: 'user-1',
        uploadId: 'sess-upload-1',
        storageBucket: 'test-media-bucket',
        storageKey: 'key',
        mimeType: 'image/png',
        status: MediaStatus.UPLOADING,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.completeUploadByUploadId('user-1', {
        uploadId: 'sess-upload-1',
        parts: [{ partNumber: 1, eTag: 'etag-1' }],
      });

      expect(res.mediaId).toBe('media-snowflake-1');
      expect(res.status).toBe(MediaStatus.READY);
    });

    it('should throw NotFoundException in completeUploadByUploadId if session not found', async () => {
      (mockSessionRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await expect(
        service.completeUploadByUploadId('user-1', {
          uploadId: 'unknown',
          parts: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create upload session using alias method createUploadSession', async () => {
      const res = await service.createUploadSession('user-1', {
        fileName: 'big.mp4',
        contentType: 'video/mp4',
        size: 70 * 1024 * 1024,
      });

      expect(res.isMultipart).toBe(true);
      expect(res.uploadId).toBe('upload-id-123');
    });
  });

  describe('findById, paginate, getUserQuota, delete', () => {
    it('should find media by ID', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'media-1',
        fileName: 'pic.jpg',
        storageKey: 'k',
        mimeType: 'image/jpeg',
        mediaType: MediaTypeCategory.IMAGE,
        sizeBytes: '500',
        status: MediaStatus.READY,
        uploadedById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.findById('media-1');
      expect(res.id).toBe('media-1');
      expect(res.fileName).toBe('pic.jpg');
    });

    it('should throw NotFoundException if findById finds nothing', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should paginate user media', async () => {
      const mockList = [
        {
          id: 'm-1',
          fileName: '1.jpg',
          storageKey: 'k1',
          mimeType: 'image/jpeg',
          mediaType: MediaTypeCategory.IMAGE,
          sizeBytes: '100',
          status: MediaStatus.READY,
          uploadedById: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      (mockMediaRepo.findAndCount as ReturnType<typeof vi.fn>).mockResolvedValue(
        [mockList, 1],
      );

      const res = await service.paginate('user-1', 1, 10);
      expect(res.total).toBe(1);
      expect(res.items.length).toBe(1);
      expect(res.page).toBe(1);
    });

    it('should get user quota', async () => {
      const res = await service.getUserQuota('user-1');
      expect(res.userId).toBe('user-1');
      expect(res.usedBytes).toBe('1000');
    });

    it('should delete media and remove storage object', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'media-1',
        uploadedById: 'user-1',
        storageBucket: 'test-media-bucket',
        storageKey: 'uploads/user-1/file.png',
        status: MediaStatus.READY,
      });

      await service.delete('user-1', 'media-1');

      expect(mockStorage.deleteObject).toHaveBeenCalledWith(
        'test-media-bucket',
        'uploads/user-1/file.png',
      );
      expect(mockMediaRepo.softDelete).toHaveBeenCalledWith('media-1');
    });

    it('should throw NotFoundException when deleting non-existent media', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await expect(service.delete('user-1', 'missing-media')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException on invalid status transition', async () => {
      (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'media-1',
        uploadedById: 'user-1',
        storageBucket: 'test-media-bucket',
        storageKey: 'uploads/user-1/file.png',
        status: MediaStatus.DELETED,
      });

      await expect(
        service.verifyDirectUpload('user-1', 'media-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
