import { describe, it, expect, vi, beforeEach } from 'vitest';
import { S3StorageService } from './s3-storage.service.js';
import type { ConfigService } from '@nestjs/config';

// Mock AWS S3 client and presigner
const mockSend = vi.fn();
vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: class {
      send = mockSend;
      public config: Record<string, unknown>;
      constructor(public options: Record<string, unknown> = {}) {
        this.config = options;
      }
    },
    PutObjectCommand: class {
      constructor(public args: Record<string, unknown>) {}
    },
    GetObjectCommand: class {
      constructor(public args: Record<string, unknown>) {}
    },
    CreateMultipartUploadCommand: class {
      constructor(public args: Record<string, unknown>) {}
    },
    UploadPartCommand: class {
      constructor(public args: Record<string, unknown>) {}
    },
    CompleteMultipartUploadCommand: class {
      constructor(public args: Record<string, unknown>) {}
    },
    AbortMultipartUploadCommand: class {
      constructor(public args: Record<string, unknown>) {}
    },
    HeadObjectCommand: class {
      constructor(public args: Record<string, unknown>) {}
    },
    DeleteObjectCommand: class {
      constructor(public args: Record<string, unknown>) {}
    },
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockImplementation(async (client, command) => {
    const base = client?.options?.endpoint || 'https://s3.mock.aws';
    return `${base}/${command.args?.Bucket || 'bucket'}/${command.args?.Key || 'key'}`;
  }),
}));

describe('S3StorageService', () => {
  let service: S3StorageService;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          S3_ENDPOINT: 'http://localhost:9000',
          S3_PUBLIC_ENDPOINT: 'https://cdn.example.com',
          S3_REGION: 'us-east-1',
          S3_ACCESS_KEY: 'minioadmin',
          S3_SECRET_KEY: 'minioadmin',
          S3_FORCE_PATH_STYLE: 'true',
          S3_BUCKET_NAME: 'test-bucket',
        };
        return config[key];
      }),
    };

    service = new S3StorageService(mockConfigService as ConfigService);
  });

  it('should return default bucket name', () => {
    expect(service.getDefaultBucket()).toBe('test-bucket');
  });

  it('should generate presigned PUT url and replace endpoint with publicEndpoint', async () => {
    const url = await service.getPresignedPutUrl('test-bucket', 'file.jpg', 'image/jpeg', 3600);
    expect(url).toContain('https://cdn.example.com/test-bucket/file.jpg');
  });

  it('should leave URL untouched if publicEndpoint is not configured', async () => {
    const rawConfigService: Partial<ConfigService> = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'S3_PUBLIC_ENDPOINT') return undefined;
        if (key === 'S3_BUCKET_NAME') return 'test-bucket';
        return undefined;
      }),
    };
    const rawService = new S3StorageService(rawConfigService as ConfigService);
    const url = await rawService.getPresignedPutUrl('test-bucket', 'file.jpg', 'image/jpeg', 3600);
    expect(url).toContain('https://s3.mock.aws/test-bucket/file.jpg');
  });

  it('should generate presigned GET url', async () => {
    const url = await service.getPresignedGetUrl('test-bucket', 'file.jpg', 1800);
    expect(url).toContain('https://cdn.example.com/test-bucket/file.jpg');
  });

  it('should create multipart upload and return UploadId', async () => {
    mockSend.mockResolvedValueOnce({ UploadId: 'upload-uuid-123' });

    const uploadId = await service.createMultipartUpload('test-bucket', 'video.mp4', 'video/mp4');
    expect(uploadId).toBe('upload-uuid-123');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should throw error if createMultipartUpload returns empty UploadId', async () => {
    mockSend.mockResolvedValueOnce({});

    await expect(
      service.createMultipartUpload('test-bucket', 'video.mp4', 'video/mp4'),
    ).rejects.toThrow('Failed to create S3 multipart upload: missing UploadId');
  });

  it('should generate presigned upload part URL', async () => {
    const url = await service.getPresignedUploadPartUrl(
      'test-bucket',
      'video.mp4',
      'upload-uuid-123',
      1,
      3600,
    );
    expect(url).toContain('https://cdn.example.com/test-bucket/video.mp4');
  });

  it('should complete multipart upload and sort parts ascending', async () => {
    mockSend.mockResolvedValueOnce({
      Location: 'https://cdn.example.com/test-bucket/video.mp4',
      ETag: '"combined-etag"',
    });

    const result = await service.completeMultipartUpload('test-bucket', 'video.mp4', 'upload-uuid-123', [
      { PartNumber: 2, ETag: 'etag-2' },
      { PartNumber: 1, ETag: 'etag-1' },
    ]);

    expect(result.eTag).toBe('"combined-etag"');
    expect(result.location).toContain('video.mp4');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should abort multipart upload', async () => {
    mockSend.mockResolvedValueOnce({});
    await service.abortMultipartUpload('test-bucket', 'video.mp4', 'upload-uuid-123');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should head object and return metadata when object exists', async () => {
    mockSend.mockResolvedValueOnce({
      ContentLength: 5000,
      ContentType: 'application/pdf',
      ETag: '"sample-etag"',
    });

    const head = await service.headObject('test-bucket', 'doc.pdf');
    expect(head).toEqual({
      contentLength: 5000,
      contentType: 'application/pdf',
      eTag: '"sample-etag"',
    });
  });

  it('should catch headObject error and return null', async () => {
    mockSend.mockRejectedValueOnce(new Error('NotFound'));

    const head = await service.headObject('test-bucket', 'missing.pdf');
    expect(head).toBeNull();
  });

  it('should delete object from bucket', async () => {
    mockSend.mockResolvedValueOnce({});
    await service.deleteObject('test-bucket', 'old.pdf');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
