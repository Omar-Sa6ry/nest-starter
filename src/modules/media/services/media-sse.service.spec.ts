import { describe, it, expect, vi } from 'vitest';
import { MediaSseService } from './media-sse.service.js';
import { MediaStatus } from '../constants/media.constants.js';
import { firstValueFrom, toArray, take } from 'rxjs';

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
    expect((event.data as any).status).toBe(MediaStatus.PENDING);
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
    expect((event.data as any).mediaId).toBe('media-target');
    expect((event.data as any).status).toBe(MediaStatus.READY);
  });
});

