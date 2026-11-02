import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { I18nService } from 'nestjs-i18n';
import { CurrentUser } from '@bts-soft/core';
import { MediaService } from './services/media.service.js';
import {
  MediaType,
  MediaResponse,
  PresignedUploadResponse,
  DownloadUrlResponse,
  PaginatedMediaResponse,
  QuotaResponse,
  MediaGeneralOperationResponse,
} from './dto/media.types.js';
import {
  RequestUploadInput,
  InitiateMultipartUploadInput,
  CompleteMultipartUploadInput,
  AbortMultipartUploadInput,
} from './inputs/media.inputs.js';
import { Auth } from '../../common/decorator/auth.decorator.js';
import { Permission } from '../../common/constant/enum.constant.js';
import { MEDIA_I18N } from './constants/media-i18n.constants.js';
import type { IAuthenticatedUser } from '../../common/interfaces/IContext.interface.js';

@Resolver(() => MediaType)
export class MediaResolver {
  constructor(
    private readonly mediaService: MediaService,
    private readonly i18n: I18nService,
  ) {}

  @Mutation(() => PresignedUploadResponse)
  @Auth([Permission.MEDIA_UPLOAD])
  async requestUploadUrl(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('input') input: RequestUploadInput,
  ): Promise<PresignedUploadResponse> {
    const data = await this.mediaService.requestUpload(user.id, input);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.UPLOAD_URL_GENERATED),
      timeStamp: new Date().toISOString(),
      data,
    };
  }

  @Mutation(() => PresignedUploadResponse)
  @Auth([Permission.MEDIA_UPLOAD])
  async initiateMultipartUpload(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('input') input: InitiateMultipartUploadInput,
  ): Promise<PresignedUploadResponse> {
    const data = await this.mediaService.initiateMultipartUpload(user.id, input);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.MULTIPART_INITIATED),
      timeStamp: new Date().toISOString(),
      data,
    };
  }

  @Mutation(() => MediaResponse)
  @Auth([Permission.MEDIA_UPLOAD])
  async completeMultipartUpload(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('input') input: CompleteMultipartUploadInput,
  ): Promise<MediaResponse> {
    const media = await this.mediaService.completeMultipartUpload(user.id, input);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.UPLOAD_COMPLETED),
      timeStamp: new Date().toISOString(),
      data: media,
    };
  }

  @Mutation(() => MediaResponse)
  @Auth([Permission.MEDIA_UPLOAD])
  async verifyDirectUpload(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('mediaId') mediaId: string,
  ): Promise<MediaResponse> {
    const media = await this.mediaService.verifyDirectUpload(user.id, mediaId);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.UPLOAD_COMPLETED),
      timeStamp: new Date().toISOString(),
      data: media,
    };
  }

  @Mutation(() => MediaGeneralOperationResponse)
  @Auth([Permission.MEDIA_UPLOAD])
  async abortMultipartUpload(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('input') input: AbortMultipartUploadInput,
  ): Promise<MediaGeneralOperationResponse> {
    await this.mediaService.abortMultipartUpload(user.id, input.mediaId);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.UPLOAD_ABORTED),
      timeStamp: new Date().toISOString(),
    };
  }

  @Query(() => DownloadUrlResponse)
  @Auth([Permission.MEDIA_VIEW])
  async getMediaDownloadUrl(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('mediaId') mediaId: string,
  ): Promise<DownloadUrlResponse> {
    const download = await this.mediaService.getDownloadUrl(user.id, mediaId);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.DOWNLOAD_URL_GENERATED),
      timeStamp: new Date().toISOString(),
      data: {
        mediaId,
        downloadUrl: download.downloadUrl,
        expiresInSeconds: download.expiresInSeconds,
      },
    };
  }

  @Query(() => MediaResponse)
  @Auth([Permission.MEDIA_VIEW])
  async getMediaById(
    @Args('mediaId') mediaId: string,
  ): Promise<MediaResponse> {
    const media = await this.mediaService.findById(mediaId);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.MEDIA_FOUND),
      timeStamp: new Date().toISOString(),
      data: media,
    };
  }

  @Query(() => PaginatedMediaResponse)
  @Auth([Permission.MEDIA_VIEW])
  async getMyMedia(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 10 }) limit: number,
  ): Promise<PaginatedMediaResponse> {
    const data = await this.mediaService.paginate(user.id, page, limit);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.MEDIA_FOUND),
      timeStamp: new Date().toISOString(),
      data,
    };
  }

  @Query(() => QuotaResponse)
  @Auth([Permission.MEDIA_VIEW])
  async getMyQuota(
    @CurrentUser() user: IAuthenticatedUser,
  ): Promise<QuotaResponse> {
    const data = await this.mediaService.getUserQuota(user.id);
    return {
      success: true,
      statusCode: 200,
      message: 'Quota retrieved successfully',
      timeStamp: new Date().toISOString(),
      data,
    };
  }

  @Mutation(() => MediaGeneralOperationResponse)
  @Auth([Permission.MEDIA_DELETE])
  async deleteMedia(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('mediaId') mediaId: string,
  ): Promise<MediaGeneralOperationResponse> {
    await this.mediaService.delete(user.id, mediaId);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.MEDIA_DELETED),
      timeStamp: new Date().toISOString(),
    };
  }
}
