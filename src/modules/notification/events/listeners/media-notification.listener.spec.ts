import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MediaNotificationListener } from './media-notification.listener.js';
import { NotificationService } from '../../notification.service.js';
import {
  MediaReadyEvent,
  MediaFailedEvent,
} from '../../../media/events/media-domain.events.js';
import { Media } from '../../../media/entities/media.entity.js';
import { MediaStatus, MediaTypeCategory } from '../../../media/constants/media.constants.js';
import { ChannelType, NotificationCategory } from '@bts-soft/core';

describe('MediaNotificationListener', () => {
  let listener: MediaNotificationListener;
  let notificationService: {
    sendNotification: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    notificationService = {
      sendNotification: vi.fn().mockResolvedValue({} as never),
    };

    listener = new MediaNotificationListener(
      notificationService as unknown as NotificationService,
    );
  });

  const baseMedia = {
    id: 'med-123',
    uploadedById: 'user-789',
    fileName: 'demo.mp4',
    mimeType: 'video/mp4',
    mediaType: MediaTypeCategory.VIDEO,
    sizeBytes: '1048576',
    status: MediaStatus.READY,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Media;

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  it('should send notification on MediaReadyEvent', async () => {
    const event = new MediaReadyEvent(baseMedia, 'user-789');
    await listener.handleMediaReady(event);

    expect(notificationService.sendNotification).toHaveBeenCalledWith({
      channel: ChannelType.IN_APP,
      recipientId: 'user-789',
      category: NotificationCategory.TRANSACTIONAL,
      subject: 'Media Ready',
      body: expect.stringContaining('demo.mp4'),
      context: expect.objectContaining({
        mediaId: 'med-123',
        status: MediaStatus.READY,
      }),
    });
  });

  it('should skip notification on MediaReadyEvent if no userId', async () => {
    const noUserMedia = { ...baseMedia, uploadedById: null } as unknown as Media;
    const event = new MediaReadyEvent(noUserMedia, undefined);
    await listener.handleMediaReady(event);

    expect(notificationService.sendNotification).not.toHaveBeenCalled();
  });

  it('should send notification on MediaFailedEvent', async () => {
    const event = new MediaFailedEvent('med-123', 'Corrupted file payload', 'user-789');
    await listener.handleMediaFailed(event);

    expect(notificationService.sendNotification).toHaveBeenCalledWith({
      channel: ChannelType.IN_APP,
      recipientId: 'user-789',
      category: NotificationCategory.TRANSACTIONAL,
      subject: 'Media Processing Failed',
      body: expect.stringContaining('Corrupted file payload'),
      context: expect.objectContaining({
        mediaId: 'med-123',
        reason: 'Corrupted file payload',
      }),
    });
  });
});
