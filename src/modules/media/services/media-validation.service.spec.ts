import { describe, it, expect, vi } from 'vitest';
import { MediaValidationService } from './media-validation.service.js';
import type { IStorageProvider } from '../interfaces/IStorageProvider.interface.js';

describe('MediaValidationService', () => {
  const service = new MediaValidationService();

  describe('validateDeclaredType', () => {
    it('should validate matching extensions and MIME types case-insensitively', () => {
      expect(service.validateDeclaredType('photo.JPG', 'image/jpeg')).toBe(true);
      expect(service.validateDeclaredType('PHOTO.PNG', 'image/png')).toBe(true);
      expect(service.validateDeclaredType('photo.jpeg', 'image/jpeg')).toBe(true);
      expect(service.validateDeclaredType('picture.png', 'image/png')).toBe(true);
      expect(service.validateDeclaredType('anim.gif', 'image/gif')).toBe(true);
      expect(service.validateDeclaredType('image.webp', 'image/webp')).toBe(true);
      expect(service.validateDeclaredType('clip.mp4', 'video/mp4')).toBe(true);
      expect(service.validateDeclaredType('movie.mov', 'video/quicktime')).toBe(true);
      expect(service.validateDeclaredType('video.webm', 'video/webm')).toBe(true);
      expect(service.validateDeclaredType('audio.mp3', 'audio/mpeg')).toBe(true);
      expect(service.validateDeclaredType('track.wav', 'audio/wav')).toBe(true);
      expect(service.validateDeclaredType('document.pdf', 'application/pdf')).toBe(true);
      expect(service.validateDeclaredType('bundle.zip', 'application/zip')).toBe(true);
    });

    it('should return false when extension does not match MIME type', () => {
      expect(service.validateDeclaredType('photo.png', 'video/mp4')).toBe(false);
      expect(service.validateDeclaredType('doc.pdf', 'image/jpeg')).toBe(false);
    });

    it('should return false if file has no extension', () => {
      expect(service.validateDeclaredType('noextension', 'image/png')).toBe(false);
    });
  });

  describe('validateStorageObject', () => {
    it('should return true when storage object exists and has positive contentLength', async () => {
      const mockStorage: Partial<IStorageProvider> = {
        headObject: vi.fn().mockResolvedValue({
          contentLength: 1024,
          contentType: 'image/png',
        }),
      };

      const result = await service.validateStorageObject(
        mockStorage as IStorageProvider,
        'bucket',
        'key',
        'image/png',
      );

      expect(result).toBe(true);
    });

    it('should return false when headObject returns null or 0 size', async () => {
      const mockStorageNull: Partial<IStorageProvider> = {
        headObject: vi.fn().mockResolvedValue(null),
      };
      const resultNull = await service.validateStorageObject(
        mockStorageNull as IStorageProvider,
        'bucket',
        'key',
        'image/png',
      );
      expect(resultNull).toBe(false);
    });
  });
});
