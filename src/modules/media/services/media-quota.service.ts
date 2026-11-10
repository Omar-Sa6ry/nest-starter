import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '@bts-soft/cache';
import { Media } from '../entities/media.entity.js';
import { UploadSession } from '../entities/upload-session.entity.js';
import { UploadSessionStatus } from '../enums/upload-session.enum.js';
import { MEDIA_CONSTANTS, MediaStatus } from '../constants/media.constants.js';
import type { IQuotaUsage } from '../interfaces/IMediaMetadata.interface.js';

@Injectable()
export class MediaQuotaService {
  private readonly QUOTA_CACHE_PREFIX = 'media:quota:';

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepo: Repository<Media>,
    @InjectRepository(UploadSession)
    private readonly sessionRepo: Repository<UploadSession>,
    private readonly redisService: RedisService,
  ) {}

  async getQuotaUsage(userId: string): Promise<IQuotaUsage> {
    const cacheKey = `${this.QUOTA_CACHE_PREFIX}${userId}`;

    const cachedUsed = await this.redisService.get<string>(cacheKey);
    let usedBytes = cachedUsed ? parseInt(cachedUsed, 10) : null;

    if (usedBytes === null || isNaN(usedBytes)) {
      const rawSum = await this.mediaRepo
        .createQueryBuilder('media')
        .select('SUM(CAST(media.size_bytes AS BIGINT))', 'totalBytes')
        .where('media.uploaded_by_id = :userId', { userId })
        .andWhere('media.status != :deleted', { deleted: MediaStatus.DELETED })
        .getRawOne<{ totalBytes?: string }>();

      usedBytes = rawSum?.totalBytes ? parseInt(rawSum.totalBytes, 10) : 0;
      // Cache quota for 5 minutes using @bts-soft/cache
      await this.redisService.set(cacheKey, usedBytes.toString(), 300);
    }

    const activeUploads = await this.sessionRepo.count({
      where: {
        userId,
        status: UploadSessionStatus.UPLOADING,
      },
    });

    return {
      userId,
      usedBytes,
      quotaBytes: MEDIA_CONSTANTS.DEFAULT_QUOTA_BYTES,
      activeUploads,
      maxConcurrent: MEDIA_CONSTANTS.MAX_CONCURRENT_UPLOADS,
    };
  }

  async invalidateQuotaCache(userId: string): Promise<void> {
    const cacheKey = `${this.QUOTA_CACHE_PREFIX}${userId}`;
    await this.redisService.del(cacheKey);
  }

  async checkCanUpload(userId: string, newSizeBytes: number): Promise<void> {
    const quota = await this.getQuotaUsage(userId);

    if (quota.usedBytes + newSizeBytes > quota.quotaBytes) {
      throw new ForbiddenException(
        `Storage quota exceeded. Used: ${quota.usedBytes} bytes, Requested: ${newSizeBytes} bytes, Max: ${quota.quotaBytes} bytes`,
      );
    }

    if (quota.activeUploads >= quota.maxConcurrent) {
      throw new ForbiddenException(
        `Concurrent uploads limit reached (${quota.maxConcurrent} active uploads). Please complete or abort existing uploads.`,
      );
    }
  }
}
