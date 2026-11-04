import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaQueueProcessor } from './media-queue.processor.js';
import { MediaStatus } from '../constants/media.constants.js';
import { MediaJobStatus, MediaJobType } from '../enums/media-job.enum.js';
import { MEDIA_JOB_NAMES } from '../constants/media-queue.constants.js';
import type { Repository } from 'typeorm';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { Media } from '../entities/media.entity.js';
import type { MediaJob } from '../entities/media-job.entity.js';
import type { MediaSseService } from '../services/media-sse.service.js';
import type { Job } from 'bullmq';
import {
  MediaReadyEvent,
  MediaFailedEvent,
} from '../events/media-domain.events.js';

describe('MediaQueueProcessor', () => {
  let processor: MediaQueueProcessor;
  let mockMediaRepo: Partial<Repository<Media>>;
  let mockJobRepo: Partial<Repository<MediaJob>>;
  let mockSse: Partial<MediaSseService>;
  let mockEventEmitter: { emit: ReturnType<typeof vi.fn> };

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

    mockEventEmitter = {
      emit: vi.fn(),
    };

    processor = new MediaQueueProcessor(
      mockMediaRepo as Repository<Media>,
      mockJobRepo as Repository<MediaJob>,
      mockSse as MediaSseService,
      mockEventEmitter as unknown as EventEmitter2,
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

    await processor.process(job);

    expect(mockJobRepo.create).not.toHaveBeenCalled();
    expect(mockSse.emit).not.toHaveBeenCalled();
  });

  it('should skip unrecognized job names gracefully', async () => {
    vi.mocked(mockMediaRepo.findOne!).mockResolvedValue({ id: 'm1' } as Media);
    const job = {
      id: 'job-x',
      name: 'unrecognized_job_name',
      data: { mediaId: 'm1' },
      attemptsMade: 0,
    } as unknown as Job;

    await processor.process(job);
    expect(mockJobRepo.create).not.toHaveBeenCalled();
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

    await processor.process(job);

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
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      MediaReadyEvent.EVENT_NAME,
      expect.any(MediaReadyEvent),
    );
  });

  it('should emit MediaFailedEvent and rethrow on failure', async () => {
    vi.mocked(mockMediaRepo.findOne!).mockResolvedValue({
      id: 'media-fail',
      uploadedById: 'user-fail',
      status: MediaStatus.PROCESSING,
    } as unknown as Media);

    vi.mocked(mockSse.emit!).mockImplementationOnce(() => {
      throw new Error('Pipeline error');
    });

    const job = {
      id: 'job-err',
      name: MEDIA_JOB_NAMES.PROCESS_PIPELINE,
      data: { mediaId: 'media-fail' },
      attemptsMade: 0,
    } as unknown as Job;

    await expect(processor.process(job)).rejects.toThrow('Pipeline error');

    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      MediaFailedEvent.EVENT_NAME,
      expect.objectContaining({
        mediaId: 'media-fail',
        userId: 'user-fail',
      }),
    );
  });
});
