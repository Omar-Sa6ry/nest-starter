import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MediaService } from './media.service.js';
import { S3StorageService } from './s3-storage.service.js';
import { MediaSseService } from './media-sse.service.js';
import { MediaQuotaService } from './media-quota.service.js';
import { MediaValidationService } from './media-validation.service.js';
import { MediaStatus, MediaTypeCategory } from '../constants/media.constants.js';
import type { Repository } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import type { Media } from '../entity/media.entity.js';
import type { MediaVersion } from '../entity/media-version.entity.js';
import type { UploadSession } from '../entity/upload-session.entity.js';

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

  beforeEach(() => {
    mockMediaRepo = {
      create: vi.fn().mockImplementation((dto) => ({ id: 'media-snowflake-1', ...dto })),
      save: vi.fn().mockImplementation((entity) => Promise.resolve({ id: 'media-snowflake-1', ...entity })),
      findOne: vi.fn(),
      findAndCount: vi.fn(),
      softDelete: vi.fn().mockResolvedValue({ affected: 1 } as never),
    };

    mockVersionRepo = {
      create: vi.fn().mockImplementation((dto) => ({ id: 'ver-1', ...dto })),
      save: vi.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    mockSessionRepo = {
      create: vi.fn().mockImplementation((dto) => ({ id: 'sess-1', ...dto })),
      save: vi.fn().mockImplementation((entity) => Promise.resolve(entity)),
      update: vi.fn().mockResolvedValue({ affected: 1 } as never),
    };

    mockStorage = {
      getDefaultBucket: vi.fn().mockReturnValue('test-media-bucket'),
      getPresignedPutUrl: vi.fn().mockResolvedValue('https://s3.amazonaws.com/test-media-bucket/presigned-put'),
      getPresignedGetUrl: vi.fn().mockResolvedValue('https://s3.amazonaws.com/test-media-bucket/presigned-get'),
      createMultipartUpload: vi.fn().mockResolvedValue('upload-id-123'),
      getPresignedUploadPartUrl: vi.fn().mockResolvedValue('https://s3.amazonaws.com/test-media-bucket/part-1'),
      completeMultipartUpload: vi.fn().mockResolvedValue({ location: 's3://bucket/key', eTag: 'etag-123' }),
      abortMultipartUpload: vi.fn().mockResolvedValue(undefined),
      headObject: vi.fn().mockResolvedValue({ contentLength: 1024, contentType: 'image/png', eTag: 'etag-123' }),
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

    service = new MediaService(
      mockMediaRepo as Repository<Media>,
      mockVersionRepo as Repository<MediaVersion>,
      mockSessionRepo as Repository<UploadSession>,
      mockStorage as S3StorageService,
      mockSse as MediaSseService,
      mockQuota as MediaQuotaService,
      mockValidation as MediaValidationService,
      mockConfig as ConfigService,
    );
  });

  it('should generate direct presigned put URL for small files (<50MB)', async () => {
    const res = await service.requestUpload('user-1', {
      fileName: 'test-image.png',
      mimeType: 'image/png',
      sizeBytes: 1024 * 1024,
    });

    expect(res.isMultipart).toBe(false);
    expect(res.uploadUrl).toContain('presigned-put');
    expect(mockStorage.getPresignedPutUrl).toHaveBeenCalledTimes(1);
    expect(mockQuota.checkCanUpload).toHaveBeenCalledWith('user-1', 1024 * 1024);
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
  });

  it('should complete multipart upload, verify object and register version', async () => {
    (mockMediaRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'media-snowflake-1',
      uploadedById: 'user-1',
      uploadId: 'upload-id-123',
      storageBucket: 'test-media-bucket',
      storageKey: 'uploads/user-1/key',
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
  });
});
