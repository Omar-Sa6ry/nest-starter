import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Media } from './entity/media.entity.js';
import { MediaVersion } from './entity/media-version.entity.js';
import { UploadSession } from './entity/upload-session.entity.js';
import { MediaJob } from './entity/media-job.entity.js';
import { MediaService } from './services/media.service.js';
import { S3StorageService } from './services/s3-storage.service.js';
import { MediaSseService } from './services/media-sse.service.js';
import { MediaQuotaService } from './services/media-quota.service.js';
import { MediaValidationService } from './services/media-validation.service.js';
import { MediaWorkerService } from './services/media-worker.service.js';
import { MediaQueueProcessor } from './workers/media-queue.processor.js';
import { MediaResolver } from './media.resolver.js';
import { MediaController } from './media.controller.js';
import { MEDIA_QUEUE_NAME } from './constants/media-queue.constants.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Media,
      MediaVersion,
      UploadSession,
      MediaJob,
    ]),
    BullModule.registerQueue({
      name: MEDIA_QUEUE_NAME,
    }),
  ],
  controllers: [MediaController],
  providers: [
    MediaService,
    S3StorageService,
    MediaSseService,
    MediaQuotaService,
    MediaValidationService,
    MediaWorkerService,
    MediaQueueProcessor,
    MediaResolver,
  ],
  exports: [
    MediaService,
    S3StorageService,
    MediaSseService,
    MediaQuotaService,
    MediaValidationService,
    MediaWorkerService,
  ],
})
export class MediaModule {}
