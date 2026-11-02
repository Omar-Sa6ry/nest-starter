import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import type { IMediaEventPayload } from '../interfaces/IMediaMetadata.interface.js';

export interface ISseMessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

@Injectable()
export class MediaSseService {
  private readonly events$ = new Subject<IMediaEventPayload>();

  emit(payload: IMediaEventPayload): void {
    this.events$.next(payload);
  }

  streamForMedia(mediaId: string): Observable<ISseMessageEvent> {
    return this.events$.asObservable().pipe(
      filter((event) => event.mediaId === mediaId),
      map((event) => ({
        data: event,
        type: 'media_update',
        id: `${event.mediaId}-${Date.now()}`,
      })),
    );
  }

  streamAll(): Observable<ISseMessageEvent> {
    return this.events$.asObservable().pipe(
      map((event) => ({
        data: event,
        type: 'media_update',
        id: `${event.mediaId}-${Date.now()}`,
      })),
    );
  }
}

