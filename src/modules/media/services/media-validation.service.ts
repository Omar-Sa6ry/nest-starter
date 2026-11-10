import { Injectable, Logger } from '@nestjs/common';
import type { IStorageProvider } from '../interfaces/IStorageProvider.interface.js';

export const EXTENSION_MIME_MAP: Readonly<Record<string, string[]>> = {
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  gif: ['image/gif'],
  webp: ['image/webp'],
  mp4: ['video/mp4'],
  mov: ['video/quicktime'],
  webm: ['video/webm'],
  mp3: ['audio/mpeg', 'audio/mp3'],
  wav: ['audio/wav', 'audio/x-wav'],
  pdf: ['application/pdf'],
  zip: ['application/zip', 'application/x-zip-compressed'],
} as const;

@Injectable()
export class MediaValidationService {
  private readonly logger = new Logger(MediaValidationService.name);

  validateDeclaredType(fileName: string, mimeType: string): boolean {
    if (!fileName.includes('.')) return false;
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext) return false;

    const allowed = EXTENSION_MIME_MAP[ext];
    if (!allowed) {
      this.logger.debug(
        `File extension ${ext} not strictly mapped to MIME ${mimeType}`,
      );
      return true;
    }

    return allowed.includes(mimeType.toLowerCase());
  }

  async validateStorageObject(
    storage: IStorageProvider,
    bucket: string,
    key: string,
    _declaredMime: string,
  ): Promise<boolean> {
    const head = await storage.headObject(bucket, key);
    if (!head || !head.contentLength || head.contentLength <= 0) {
      return false;
    }
    return true;
  }

  validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
    if (!buffer || buffer.length === 0) return false;
    const lowerMime = declaredMime.toLowerCase();

    // JPEG: FF D8 FF
    if (lowerMime === 'image/jpeg') {
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (lowerMime === 'image/png') {
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    }

    // GIF: GIF87a or GIF89a (47 49 46 38)
    if (lowerMime === 'image/gif') {
      return (
        buffer.length >= 4 &&
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38
      );
    }

    // PDF: %PDF (25 50 44 46)
    if (lowerMime === 'application/pdf') {
      return (
        buffer.length >= 4 &&
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46
      );
    }

    // MP4/QuickTime: starts with ftyp at byte offset 4
    if (lowerMime === 'video/mp4' || lowerMime === 'video/quicktime') {
      if (buffer.length >= 8) {
        const ftyp = buffer.toString('utf8', 4, 8);
        return ftyp === 'ftyp' || ftyp === 'moov' || ftyp === 'mdat';
      }
      return false;
    }

    // Default true for non-strict or archive types
    return true;
  }
}
