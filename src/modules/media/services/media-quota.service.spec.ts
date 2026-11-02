import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MediaQuotaService } from './media-quota.service.js';
import { MediaStatus } from '../constants/media.constants.js';
import { UploadSessionStatus } from '../entities/upload-session.entity.js';
import { ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { RedisService } from '@bts-soft/cache';
import type { Media } from '../entities/media.entity.js';
import type { UploadSession } from '../entities/upload-session.entity.js';

describe('MediaQuotaService', () => {
  let service: MediaQuotaService;
  let mockMediaRepo: Partial<Repository<Media>>;
  let mockSessionRepo: Partial<Repository<UploadSession>>;
  let mockRedis: Partial<RedisService>;

  beforeEach(() => {
    mockMediaRepo = {
      createQueryBuilder: vi.fn(),
    };
    mockSessionRepo = {
      count: vi.fn().mockResolvedValue(0),
    };
    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined as never),
      del: vi.fn().mockResolvedValue(undefined as never),
    };

    service = new MediaQuotaService(
      mockMediaRepo as Repository<Media>,
      mockSessionRepo as Repository<UploadSession>,
      mockRedis as RedisService,
    );
  });

  it('should return cached quota usage when available in redis', async () => {
    vi.mocked(mockRedis.get!).mockResolvedValue('5000');
    vi.mocked(mockSessionRepo.count!).mockResolvedValue(2);

    const result = await service.getQuotaUsage('user-1');

    expect(result.userId).toBe('user-1');
    expect(result.usedBytes).toBe(5000);
    expect(result.activeUploads).toBe(2);
    expect(mockMediaRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('should compute quota from DB on cache miss and cache result', async () => {
    const qbMock = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getRawOne: vi.fn().mockResolvedValue({ totalBytes: '123456' }),
    };
    vi.mocked(mockMediaRepo.createQueryBuilder!).mockReturnValue(qbMock as never);
    vi.mocked(mockSessionRepo.count!).mockResolvedValue(1);

    const result = await service.getQuotaUsage('user-1');

    expect(result.usedBytes).toBe(123456);
    expect(result.activeUploads).toBe(1);
    expect(mockRedis.set).toHaveBeenCalledWith('media:quota:user-1', '123456', 300);
  });

  it('should handle zero sum in DB gracefully on cache miss', async () => {
    const qbMock = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getRawOne: vi.fn().mockResolvedValue(null),
    };
    vi.mocked(mockMediaRepo.createQueryBuilder!).mockReturnValue(qbMock as never);

    const result = await service.getQuotaUsage('user-1');
    expect(result.usedBytes).toBe(0);
  });

  it('should invalidate quota cache', async () => {
    await service.invalidateQuotaCache('user-1');
    expect(mockRedis.del).toHaveBeenCalledWith('media:quota:user-1');
  });

  describe('checkCanUpload', () => {
    it('should pass check when within limits', async () => {
      vi.mocked(mockRedis.get!).mockResolvedValue('1000');
      vi.mocked(mockSessionRepo.count!).mockResolvedValue(1);

      await expect(service.checkCanUpload('user-1', 2000)).resolves.toBeUndefined();
    });

    it('should throw ForbiddenException if byte quota is exceeded', async () => {
      // DEFAULT_QUOTA_BYTES is 50GB = 53687091200
      vi.mocked(mockRedis.get!).mockResolvedValue('53687091100');
      vi.mocked(mockSessionRepo.count!).mockResolvedValue(1);

      await expect(service.checkCanUpload('user-1', 500)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if max concurrent uploads limit is reached', async () => {
      vi.mocked(mockRedis.get!).mockResolvedValue('1000');
      vi.mocked(mockSessionRepo.count!).mockResolvedValue(5); // MAX_CONCURRENT_UPLOADS = 5

      await expect(service.checkCanUpload('user-1', 1000)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});

