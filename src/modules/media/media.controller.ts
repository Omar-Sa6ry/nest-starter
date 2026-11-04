import { Controller, Param, Sse, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { MediaSseService } from './services/media-sse.service.js';
import type { ISseMessageEvent } from './interfaces/IMediaMetadata.interface.js';
import { MediaService } from './services/media.service.js';
import { Public, CurrentUser } from '@bts-soft/core';
import { Auth } from '../../common/decorator/auth.decorator.js';
import { Permission } from '../../common/constant/enum.constant.js';
import type { IAuthenticatedUser } from '../../common/interfaces/IContext.interface.js';

@Controller('media')
export class MediaController {
  constructor(
    private readonly sseService: MediaSseService,
    private readonly mediaService: MediaService,
  ) {}

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

  @Get(':id')
  @Auth([Permission.MEDIA_VIEW])
  async getMediaInfo(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.mediaService.findById(id);
    res.status(200).json({
      statusCode: 200,
      message: 'Media retrieved successfully',
      timestamp: new Date().toISOString(),
      success: true,
      data,
    });
  }

  @Get(':id/download')
  @Auth([Permission.MEDIA_VIEW])
  async downloadRedirect(
    @CurrentUser() user: IAuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { downloadUrl } = await this.mediaService.getDownloadUrl(user.id, id);
    res.redirect(302, downloadUrl);
  }
}
