import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChannelType, NotificationCategory } from '@bts-soft/core';
import {
  MediaReadyEvent,
  MediaFailedEvent,
} from '../../../media/events/media-domain.events.js';
import { NotificationService } from '../../notification.service.js';

@Injectable()
export class MediaNotificationListener {
  private readonly logger = new Logger(MediaNotificationListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent(MediaReadyEvent.EVENT_NAME)
  async handleMediaReady(event: MediaReadyEvent): Promise<void> {
    const { media, userId } = event;
    const targetUserId = userId || media.uploadedById;

    this.logger.log(
      `Received MediaReadyEvent for media ${media.id} (user: ${targetUserId})`,
    );

    if (!targetUserId) {
      this.logger.debug(
        `Media ${media.id} has no associated userId; skipping user notification.`,
      );
      return;
    }

    try {
      await this.notificationService.sendNotification({
        channel: ChannelType.IN_APP,
        recipientId: targetUserId,
        category: NotificationCategory.TRANSACTIONAL,
        subject: 'Media Ready',
        body: `Your uploaded file "${media.fileName || media.id}" is fully processed and ready.`,
        context: {
          mediaId: media.id,
          mimeType: media.mimeType,
          sizeBytes: media.sizeBytes,
          status: media.status,
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send media ready notification for ${media.id}: ${msg}`,
      );
    }
  }

  @OnEvent(MediaFailedEvent.EVENT_NAME)
  async handleMediaFailed(event: MediaFailedEvent): Promise<void> {
    const { mediaId, reason, userId } = event;

    this.logger.log(
      `Received MediaFailedEvent for media ${mediaId} (user: ${userId})`,
    );

    if (!userId) {
      this.logger.debug(
        `Media ${mediaId} failure event has no associated userId; skipping user notification.`,
      );
      return;
    }

    try {
      await this.notificationService.sendNotification({
        channel: ChannelType.IN_APP,
        recipientId: userId,
        category: NotificationCategory.TRANSACTIONAL,
        subject: 'Media Processing Failed',
        body: `Processing for your uploaded file failed: ${reason}`,
        context: {
          mediaId,
          reason,
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send media failure notification for ${mediaId}: ${msg}`,
      );
    }
  }
}
