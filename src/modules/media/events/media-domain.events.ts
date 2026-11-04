import { Media } from '../entities/media.entity.js';

export class MediaReadyEvent {
  static readonly EVENT_NAME = 'media.ready';

  constructor(
    public readonly media: Media,
    public readonly userId?: string,
  ) {}
}

export class MediaFailedEvent {
  static readonly EVENT_NAME = 'media.failed';

  constructor(
    public readonly mediaId: string,
    public readonly reason: string,
    public readonly userId?: string,
  ) {}
}

