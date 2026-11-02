import {
  Controller,
  Param,
  Sse,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { MediaSseService, type ISseMessageEvent } from './services/media-sse.service.js';
import { Public } from '@bts-soft/core';

@Controller('media')
export class MediaController {
  constructor(private readonly sseService: MediaSseService) {}

  @Public()
  @Sse('events')
  streamAllEvents(): Observable<ISseMessageEvent> {
    return this.sseService.streamAll();
  }

  @Public()
  @Sse('events/:mediaId')
  streamMediaEvents(
    @Param('mediaId') mediaId: string,
  ): Observable<ISseMessageEvent> {
    return this.sseService.streamForMedia(mediaId);
  }
}
