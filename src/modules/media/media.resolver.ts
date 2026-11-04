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
  UploadStatusResponse,
  MediaVersionResponse,
  MediaJobResponse,
} from './dto/media.types.js';
import {
  RequestUploadInput,
  InitiateMultipartUploadInput,
  CompleteMultipartUploadInput,
  AbortMultipartUploadInput,
  CreateUploadSessionInput,
  CompleteUploadInput,
  UpdateMediaInput,
  MediaListFilterInput,
} from './input/media.inputs.js';
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
    const data = await this.mediaService.initiateMultipartUpload(
      user.id,
      input,
    );
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
    const media = await this.mediaService.completeMultipartUpload(
      user.id,
      input,
    );
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
  async downloadUrl(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('mediaId') mediaId: string,
    @Args('versionType', { type: () => String, nullable: true })
    versionType?: string,
    @Args('expirySeconds', { type: () => Int, nullable: true })
    expirySeconds?: number,
  ): Promise<DownloadUrlResponse> {
    const download = await this.mediaService.getDownloadUrl(
      user.id,
      mediaId,
      versionType,
      expirySeconds,
    );
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.DOWNLOAD_URL_GENERATED),
      timeStamp: new Date().toISOString(),
      data: download,
    };
  }

  @Mutation(() => PresignedUploadResponse)
  @Auth([Permission.MEDIA_UPLOAD])
  async createUploadSession(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('input') input: CreateUploadSessionInput,
  ): Promise<PresignedUploadResponse> {
    const data = await this.mediaService.createUploadSession(user.id, input);
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
  async completeUpload(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('input') input: CompleteUploadInput,
  ): Promise<MediaResponse> {
    const res = await this.mediaService.completeUploadByUploadId(
      user.id,
      input,
    );
    const media = await this.mediaService.findById(res.mediaId);
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
  async abortUpload(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('uploadId') uploadId: string,
  ): Promise<MediaGeneralOperationResponse> {
    await this.mediaService.abortUploadByUploadId(user.id, uploadId);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.UPLOAD_ABORTED),
      timeStamp: new Date().toISOString(),
    };
  }

  @Query(() => UploadStatusResponse)
  @Auth([Permission.MEDIA_VIEW])
  async uploadStatus(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('uploadId') uploadId: string,
  ): Promise<UploadStatusResponse> {
    const data = await this.mediaService.getUploadStatus(user.id, uploadId);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.UPLOAD_STATUS_RETRIEVED),
      timeStamp: new Date().toISOString(),
      data,
    };
  }

  @Query(() => MediaResponse)
  @Auth([Permission.MEDIA_VIEW])
  async getMediaById(@Args('mediaId') mediaId: string): Promise<MediaResponse> {
    const media = await this.mediaService.findById(mediaId);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.MEDIA_FOUND),
      timeStamp: new Date().toISOString(),
      data: media,
    };
  }

  @Mutation(() => MediaResponse)
  @Auth([Permission.MEDIA_UPLOAD])
  async updateMedia(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('input') input: UpdateMediaInput,
  ): Promise<MediaResponse> {
    const media = await this.mediaService.updateMedia(user.id, input);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.MEDIA_UPDATED),
      timeStamp: new Date().toISOString(),
      data: media,
    };
  }

  @Query(() => MediaVersionResponse)
  @Auth([Permission.MEDIA_VIEW])
  async listMediaVersions(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('mediaId') mediaId: string,
  ): Promise<MediaVersionResponse> {
    const versions = await this.mediaService.listVersions(mediaId, user.id);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.VERSIONS_FOUND),
      timeStamp: new Date().toISOString(),
      data: versions,
    };
  }

  @Query(() => MediaJobResponse)
  @Auth([Permission.MEDIA_VIEW])
  async getMediaJobs(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('mediaId') mediaId: string,
  ): Promise<MediaJobResponse> {
    const jobs = await this.mediaService.listJobs(mediaId, user.id);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.JOBS_FOUND),
      timeStamp: new Date().toISOString(),
      data: jobs,
    };
  }

  @Query(() => PaginatedMediaResponse)
  @Auth([Permission.MEDIA_VIEW])
  async getMyMedia(
    @CurrentUser() user: IAuthenticatedUser,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 })
    page: number,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 10 })
    limit: number,
    @Args('filter', { type: () => MediaListFilterInput, nullable: true })
    filter?: MediaListFilterInput,
  ): Promise<PaginatedMediaResponse> {
    const data = await this.mediaService.paginate(user.id, page, limit, filter);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.MEDIA_LIST_FOUND),
      timeStamp: new Date().toISOString(),
      data,
    };
  }

  @Query(() => PaginatedMediaResponse)
  @Auth([Permission.EDIT_USER_ROLE])
  async adminListAllMedia(
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 })
    page: number,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 10 })
    limit: number,
    @Args('filter', { type: () => MediaListFilterInput, nullable: true })
    filter?: MediaListFilterInput,
  ): Promise<PaginatedMediaResponse> {
    const data = await this.mediaService.adminListMedia(page, limit, filter);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(MEDIA_I18N.MEDIA_LIST_FOUND),
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
      message: await this.i18n.t(MEDIA_I18N.QUOTA_RETRIEVED),
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
