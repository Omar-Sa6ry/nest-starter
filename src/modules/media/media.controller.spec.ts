import { describe, it, expect, vi } from 'vitest';
import { MediaController } from './media.controller.js';
import { MediaSseService } from './services/media-sse.service.js';
import { of } from 'rxjs';

describe('MediaController', () => {
  it('should delegate streamAllEvents to MediaSseService', () => {
    const mockSse = {
      streamAll: vi.fn().mockReturnValue(of({ data: 'all' })),
      streamForMedia: vi.fn(),
    };
    const controller = new MediaController(mockSse as unknown as MediaSseService);

    const stream = controller.streamAllEvents();
    expect(mockSse.streamAll).toHaveBeenCalled();
    expect(stream).toBeDefined();
  });

  it('should delegate streamMediaEvents to MediaSseService', () => {
    const mockSse = {
      streamAll: vi.fn(),
      streamForMedia: vi.fn().mockReturnValue(of({ data: 'media-1' })),
    };
    const controller = new MediaController(mockSse as unknown as MediaSseService);

    const stream = controller.streamMediaEvents('media-1');
    expect(mockSse.streamForMedia).toHaveBeenCalledWith('media-1');
    expect(stream).toBeDefined();
  });
});

