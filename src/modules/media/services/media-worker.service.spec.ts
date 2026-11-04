import { describe, it, expect, vi } from 'vitest';
import { MediaWorkerService } from './media-worker.service.js';
import type { Queue } from 'bullmq';
import { MEDIA_JOB_NAMES, type IMediaJobData } from '../constants/media-queue.constants.js';

describe('MediaWorkerService', () => {
  it('should enqueue pipeline job into BullMQ queue', async () => {
    const mockQueue: Partial<Queue<IMediaJobData, void, string>> = {
      add: vi.fn().mockResolvedValue({ id: 'job-1' } as never),
    };

    const service = new MediaWorkerService(mockQueue as Queue<IMediaJobData, void, string>);

    const payload: IMediaJobData = {
      mediaId: 'media-123',
      storageKey: 'uploads/user-1/file.mp4',
      bucket: 'test-bucket',
      mimeType: 'video/mp4',
      userId: 'user-1',
    };

    await service.dispatchProcessingJob(payload);

    expect(mockQueue.add).toHaveBeenCalledWith(
      MEDIA_JOB_NAMES.PROCESS_PIPELINE,
      payload,
      expect.objectContaining({
        attempts: 3,
        removeOnComplete: true,
      }),
    );
  });

  it('should enqueue thumbnail and scan jobs', async () => {
    const mockQueue: Partial<Queue<IMediaJobData, void, string>> = {
      add: vi.fn().mockResolvedValue({ id: 'job-1' } as never),
    };
    const service = new MediaWorkerService(mockQueue as Queue<IMediaJobData, void, string>);
    const payload: IMediaJobData = {
      mediaId: 'm1',
      storageKey: 'k',
      bucket: 'b',
      mimeType: 'image/png',
      userId: 'u1',
    };

    await service.dispatchThumbnailJob(payload);
    expect(mockQueue.add).toHaveBeenCalledWith(
      MEDIA_JOB_NAMES.THUMBNAIL_GENERATION,
      payload,
      expect.any(Object),
    );

    await service.dispatchScanJob(payload);
    expect(mockQueue.add).toHaveBeenCalledWith(
      MEDIA_JOB_NAMES.SECURITY_SCAN,
      payload,
      expect.any(Object),
    );
  });
});
