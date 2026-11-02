import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaQueueProcessor } from './media-queue.processor.js';
import { MediaStatus } from '../constants/media.constants.js';
import { MediaJobStatus, MediaJobType } from '../entities/media-job.entity.js';
import { MEDIA_JOB_NAMES } from '../constants/media-queue.constants.js';
import type { Repository } from 'typeorm';
import type { Media } from '../entities/media.entity.js';
import type { MediaJob } from '../entities/media-job.entity.js';
import type { MediaSseService } from '../services/media-sse.service.js';
import type { Job } from 'bullmq';

describe('MediaQueueProcessor', () => {
  let processor: MediaQueueProcessor;
  let mockMediaRepo: Partial<Repository<Media>>;
  let mockJobRepo: Partial<Repository<MediaJob>>;
  let mockSse: Partial<MediaSseService>;

  beforeEach(() => {
    mockMediaRepo = {
      findOne: vi.fn(),
      update: vi.fn().mockResolvedValue({ affected: 1 } as never),
    };

    mockJobRepo = {
      create: vi.fn().mockImplementation((dto) => ({ id: 'job-entity-1', ...dto })),
      save: vi.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    mockSse = {
      emit: vi.fn(),
    };

    processor = new MediaQueueProcessor(
      mockMediaRepo as Repository<Media>,
      mockJobRepo as Repository<MediaJob>,
      mockSse as MediaSseService,
    );
  });

  it('should skip processing if media does not exist', async () => {
    vi.mocked(mockMediaRepo.findOne!).mockResolvedValue(null);

    const job = {
      id: 'job-1',
      name: MEDIA_JOB_NAMES.PROCESS_PIPELINE,
      data: { mediaId: 'missing-media' },
      attemptsMade: 0,
    } as unknown as Job;

    await processor.process(job as any);

    expect(mockJobRepo.create).not.toHaveBeenCalled();
    expect(mockSse.emit).not.toHaveBeenCalled();
  });

  it('should process pipeline successfully, emit SSE milestones, update media and job status', async () => {
    vi.mocked(mockMediaRepo.findOne!).mockResolvedValue({
      id: 'media-1',
      status: MediaStatus.PROCESSING,
    } as Media);

    const job = {
      id: 'job-1',
      name: MEDIA_JOB_NAMES.PROCESS_PIPELINE,
      data: { mediaId: 'media-1' },
      attemptsMade: 0,
    } as unknown as Job;

    await processor.process(job as any);

    expect(mockJobRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaId: 'media-1',
        jobType: MediaJobType.METADATA_EXTRACTION,
        status: MediaJobStatus.RUNNING,
      }),
    );

    expect(mockSse.emit).toHaveBeenCalledTimes(4); // 20%, 50%, 85%, 100%
    expect(mockMediaRepo.update).toHaveBeenCalledWith(
      { id: 'media-1' },
      { status: MediaStatus.READY },
    );
    expect(mockJobRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MediaJobStatus.COMPLETED,
      }),
    );
  });

  it('should catch error, mark job as FAILED and rethrow error', async () => {
    vi.mocked(mockMediaRepo.findOne!).mockResolvedValue({
      id: 'media-1',
      status: MediaStatus.PROCESSING,
    } as Media);

    vi.mocked(mockMediaRepo.update!).mockRejectedValue(new Error('DB failure'));

    const job = {
      id: 'job-err',
      name: MEDIA_JOB_NAMES.PROCESS_PIPELINE,
      data: { mediaId: 'media-1' },
      attemptsMade: 1,
    } as unknown as Job;

    await expect(processor.process(job as any)).rejects.toThrow('DB failure');

    expect(mockJobRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MediaJobStatus.FAILED,
        lastError: expect.stringContaining('DB failure'),
      }),
    );
  });
});

