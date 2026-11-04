import { describe, it, expect, vi } from 'vitest';
import { MediaController } from './media.controller.js';
import { MediaSseService } from './services/media-sse.service.js';
import { MediaService } from './services/media.service.js';
import { of } from 'rxjs';
import type { Response } from 'express';
import type { MediaType } from './dto/media.types.js';
import { MediaStatus, MediaTypeCategory } from './constants/media.constants.js';
import { Role } from '../../common/constant/enum.constant.js';

describe('MediaController', () => {
  let mockSse: Partial<MediaSseService>;
  let mockMediaService: Partial<MediaService>;
  let controller: MediaController;

  beforeEach(() => {
    mockSse = {
      streamAll: vi.fn().mockReturnValue(of({ data: 'all' })),
      streamForMedia: vi.fn().mockReturnValue(of({ data: 'media-1' })),
    };
    mockMediaService = {
      findById: vi.fn().mockResolvedValue({
        id: 'm1',
        fileName: 'test.png',
        storageKey: 'key',
        mimeType: 'image/png',
        mediaType: MediaTypeCategory.IMAGE,
        sizeBytes: '100',
        status: MediaStatus.READY,
        uploadedById: 'u1',
        isPublic: true,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as MediaType),
      getDownloadUrl: vi.fn().mockResolvedValue({
        downloadUrl: 'https://s3.download.url',
        expiresInSeconds: 3600,
      }),
    };

    controller = new MediaController(
      mockSse as MediaSseService,
      mockMediaService as MediaService,
    );
  });

  it('should delegate streamAllEvents to MediaSseService', () => {
    const stream = controller.streamAllEvents();
    expect(mockSse.streamAll).toHaveBeenCalled();
    expect(stream).toBeDefined();
  });

  it('should delegate streamMediaEvents to MediaSseService', () => {
    const stream = controller.streamMediaEvents('media-1');
    expect(mockSse.streamForMedia).toHaveBeenCalledWith('media-1');
    expect(stream).toBeDefined();
  });

  it('should get media info via REST', async () => {
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res = { status: statusMock } as unknown as Response;

    await controller.getMediaInfo('m1', res);

    expect(mockMediaService.findById).toHaveBeenCalledWith('m1');
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 200,
        success: true,
      }),
    );
  });

  it('should redirect to download url via REST', async () => {
    const redirectMock = vi.fn();
    const res = { redirect: redirectMock } as unknown as Response;
    const user = { id: 'u1', email: 'a@b.com', role: Role.USER, permissions: [] };

    await controller.downloadRedirect(user, 'm1', res);

    expect(mockMediaService.getDownloadUrl).toHaveBeenCalledWith('u1', 'm1');
    expect(redirectMock).toHaveBeenCalledWith(302, 'https://s3.download.url');
  });
});
