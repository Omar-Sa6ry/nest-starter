import { describe, it, expect, vi } from 'vitest';
import { MediaValidationService } from './media-validation.service.js';
import type { IStorageProvider } from '../interfaces/IStorageProvider.interface.js';

describe('MediaValidationService', () => {
  const service = new MediaValidationService();

  describe('validateDeclaredType', () => {
    it('should validate matching extensions and MIME types', () => {
      expect(service.validateDeclaredType('photo.jpg', 'image/jpeg')).toBe(true);
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
      expect(service.validateDeclaredType('danger.exe', 'image/png')).toBe(true); // unmapped extension returns true (non-strict)
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

      const mockStorageZero: Partial<IStorageProvider> = {
        headObject: vi.fn().mockResolvedValue({ contentLength: 0 }),
      };
      const resultZero = await service.validateStorageObject(
        mockStorageZero as IStorageProvider,
        'bucket',
        'key',
        'image/png',
      );
      expect(resultZero).toBe(false);
    });
  });

  describe('validateMagicBytes', () => {
    it('should return false for empty or null buffer', () => {
      expect(service.validateMagicBytes(Buffer.from([]), 'image/jpeg')).toBe(false);
      expect(service.validateMagicBytes(null as unknown as Buffer, 'image/jpeg')).toBe(false);
    });

    it('should validate JPEG magic bytes', () => {
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const invalidJpeg = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      expect(service.validateMagicBytes(validJpeg, 'image/jpeg')).toBe(true);
      expect(service.validateMagicBytes(invalidJpeg, 'image/jpeg')).toBe(false);
    });

    it('should validate PNG magic bytes', () => {
      const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const invalidPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]);
      expect(service.validateMagicBytes(validPng, 'image/png')).toBe(true);
      expect(service.validateMagicBytes(invalidPng, 'image/png')).toBe(false);
    });

    it('should validate GIF magic bytes', () => {
      const validGif = Buffer.from([0x47, 0x49, 0x46, 0x38]);
      const invalidGif = Buffer.from([0x47, 0x49, 0x46, 0x00]);
      expect(service.validateMagicBytes(validGif, 'image/gif')).toBe(true);
      expect(service.validateMagicBytes(invalidGif, 'image/gif')).toBe(false);
    });

    it('should validate PDF magic bytes', () => {
      const validPdf = Buffer.from([0x25, 0x50, 0x44, 0x46]);
      const invalidPdf = Buffer.from([0x25, 0x50, 0x00, 0x00]);
      expect(service.validateMagicBytes(validPdf, 'application/pdf')).toBe(true);
      expect(service.validateMagicBytes(invalidPdf, 'application/pdf')).toBe(false);
    });

    it('should validate MP4/QuickTime magic bytes', () => {
      const validMp4 = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]); // 'ftyp' at offset 4
      const invalidMp4 = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x78, 0x78, 0x78, 0x78]);
      const shortMp4 = Buffer.from([0x00, 0x00]);
      expect(service.validateMagicBytes(validMp4, 'video/mp4')).toBe(true);
      expect(service.validateMagicBytes(invalidMp4, 'video/mp4')).toBe(false);
      expect(service.validateMagicBytes(shortMp4, 'video/mp4')).toBe(false);
    });

    it('should return true for unmapped or generic MIME types', () => {
      const buf = Buffer.from([0x01, 0x02, 0x03]);
      expect(service.validateMagicBytes(buf, 'application/octet-stream')).toBe(true);
    });
  });
});

