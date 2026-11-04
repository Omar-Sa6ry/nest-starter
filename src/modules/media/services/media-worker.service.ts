import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  MEDIA_QUEUE_NAME,
  MEDIA_JOB_NAMES,
  type IMediaJobData,
} from '../constants/media-queue.constants.js';

@Injectable()
export class MediaWorkerService {
  private readonly logger = new Logger(MediaWorkerService.name);

  constructor(
    @InjectQueue(MEDIA_QUEUE_NAME)
    private readonly mediaQueue: Queue<IMediaJobData, void, string>,
  ) {}

  async dispatchProcessingJob(data: IMediaJobData): Promise<void> {
    this.logger.log(
      `Enqueuing BullMQ background processing job for media ${data.mediaId}`,
    );
    await this.mediaQueue.add(MEDIA_JOB_NAMES.PROCESS_PIPELINE, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async dispatchThumbnailJob(data: IMediaJobData): Promise<void> {
    this.logger.log(`Enqueuing thumbnail job for media ${data.mediaId}`);
    await this.mediaQueue.add(MEDIA_JOB_NAMES.THUMBNAIL_GENERATION, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async dispatchScanJob(data: IMediaJobData): Promise<void> {
    this.logger.log(`Enqueuing security scan job for media ${data.mediaId}`);
    await this.mediaQueue.add(MEDIA_JOB_NAMES.SECURITY_SCAN, data, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async dispatchMetadataJob(data: IMediaJobData): Promise<void> {
    this.logger.log(
      `Enqueuing metadata extraction job for media ${data.mediaId}`,
    );
    await this.mediaQueue.add(MEDIA_JOB_NAMES.METADATA_EXTRACTION, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
