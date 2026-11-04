import { describe, it, expect } from 'vitest';
import { MediaSseService } from './media-sse.service.js';
import { MediaStatus } from '../constants/media.constants.js';
import { firstValueFrom, take } from 'rxjs';
import type { IMediaEventPayload } from '../interfaces/IMediaMetadata.interface.js';

describe('MediaSseService', () => {
  it('should stream all emitted events', async () => {
    const sse = new MediaSseService();
    const eventPromise = firstValueFrom(sse.streamAll());

    sse.emit({
      mediaId: 'media-1',
      status: MediaStatus.PENDING,
      message: 'Upload started',
    });

    const event = await eventPromise;
    expect(event.type).toBe('media_update');
    expect(event.id).toContain('media-1-');
    const data = event.data as IMediaEventPayload;
    expect(data.status).toBe(MediaStatus.PENDING);
  });

  it('should filter events for specific mediaId in streamForMedia', async () => {
    const sse = new MediaSseService();
    const stream = sse.streamForMedia('media-target').pipe(take(1));
    const eventPromise = firstValueFrom(stream);

    // Emit for unrelated media
    sse.emit({
      mediaId: 'media-other',
      status: MediaStatus.PROCESSING,
    });

    // Emit for target media
    sse.emit({
      mediaId: 'media-target',
      status: MediaStatus.READY,
      progressPercent: 100,
    });

    const event = await eventPromise;
    const data = event.data as IMediaEventPayload;
    expect(data.mediaId).toBe('media-target');
    expect(data.status).toBe(MediaStatus.READY);
  });
});
