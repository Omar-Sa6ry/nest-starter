import { Resolver, Mutation, Query, Args, Int } from '@nestjs/graphql';
import { I18nService } from 'nestjs-i18n';
import { ForbiddenException } from '@nestjs/common';
import { ChannelType, NotificationCategory, CurrentUser } from '@bts-soft/core';
import { NotificationService } from './notification.service.js';
import { SendNotificationInput } from './inputs/send-notification.input.js';
import { UpdateNotificationPreferenceInput } from './inputs/update-preference.input.js';
import {
  NotificationDispatchResponse,
  DeadLetterStatsResponse,
  NotificationPreferenceResponse,
} from './dtos/notification-response.types.js';
import {
  DeadLetterJobDiagnosticsType,
  NotificationDispatchPayload,
  NotificationPreferenceStatusType,
} from './dtos/notification.types.js';
import { IntResponse } from '../../common/graphql/general-response.type.js';
import { NOTIFICATION_I18N } from './constants/notification-i18n.constants.js';
import { COMMON_I18N } from '../../common/constant/common-i18n.constants.js';
import { Auth } from '../../common/decorator/auth.decorator.js';
import { Permission, Role } from '../../common/constant/enum.constant.js';
import type { IAuthenticatedUser } from '../../common/interfaces/IContext.interface.js';

import { UserService } from '../user/user.service.js';

@Resolver()
export class NotificationResolver {
  constructor(
    private readonly notificationAppService: NotificationService,
    private readonly userService: UserService,
    private readonly i18n: I18nService,
  ) {}

  private async assertCanAccessUserResource(
    currentUser: IAuthenticatedUser,
    targetRecipient: string,
  ): Promise<void> {
    const isAdmin = currentUser?.role === Role.ADMIN;
    const hasManagePermission = currentUser?.permissions?.includes(
      Permission.NOTIFICATION_MANAGE,
    );

    if (isAdmin || hasManagePermission) {
      return;
    }

    // Direct match with authenticated session (ID or Email)
    if (
      currentUser?.id === targetRecipient ||
      currentUser?.email?.toLowerCase() === targetRecipient.toLowerCase()
    ) {
      return;
    }

    // Resolve user in DB by ID or Email
    let targetUser = await this.userService.findById(targetRecipient).catch(() => null);
    if (!targetUser) {
      targetUser = await this.userService.findByEmail(targetRecipient).catch(() => null);
    }

    const isOwner =
      targetUser &&
      (currentUser?.id === targetUser.id ||
        currentUser?.email?.toLowerCase() === targetUser.email.toLowerCase());

    if (!isOwner) {
      throw new ForbiddenException(
        this.i18n.t(COMMON_I18N.INSUFFICIENT_PERMISSIONS),
      );
    }
  }

  @Mutation(() => NotificationDispatchResponse, {
    description:
      'Dispatch a multi-channel notification or enqueue for background delivery',
  })
  @Auth([Permission.NOTIFICATION_SEND])
  async sendNotification(@Args('input') input: SendNotificationInput): Promise<{
    statusCode: number;
    success: boolean;
    message: string;
    timeStamp: string;
    data: NotificationDispatchPayload;
  }> {
    const data = await this.notificationAppService.sendNotification(input);
    return {
      statusCode: 200,
      success: true,
      message: this.i18n.t(NOTIFICATION_I18N.QUEUED_SUCCESS),
      timeStamp: new Date().toISOString(),
      data,
    };
  }

  @Mutation(() => NotificationPreferenceResponse, {
    description: 'Update user notification channel opt-in/opt-out preferences',
  })
  @Auth()
  async updateNotificationPreferences(
    @Args('input') input: UpdateNotificationPreferenceInput,
    @CurrentUser() currentUser: IAuthenticatedUser,
  ): Promise<{
    statusCode: number;
    success: boolean;
    message: string;
    timeStamp: string;
    data: NotificationPreferenceStatusType;
  }> {
    await this.assertCanAccessUserResource(currentUser, input.recipientId);

    const data = await this.notificationAppService.updatePreferences(input);
    return {
      statusCode: 200,
      success: true,
      message: this.i18n.t(NOTIFICATION_I18N.PREFERENCES_UPDATED),
      timeStamp: new Date().toISOString(),
      data,
    };
  }

  @Query(() => NotificationPreferenceResponse, {
    description: 'Get user opt-out status for a specific notification channel',
  })
  @Auth()
  async getNotificationPreferenceStatus(
    @Args('recipientId', { type: () => String }) recipientId: string,
    @Args('channel', { type: () => ChannelType }) channel: ChannelType,
    @CurrentUser() currentUser: IAuthenticatedUser,
    @Args('category', { type: () => NotificationCategory, nullable: true })
    category?: NotificationCategory,
  ): Promise<{
    statusCode: number;
    success: boolean;
    message: string;
    timeStamp: string;
    data: NotificationPreferenceStatusType;
  }> {
    await this.assertCanAccessUserResource(currentUser, recipientId);

    const data = await this.notificationAppService.getPreferenceStatus(
      recipientId,
      channel,
      category,
    );
    return {
      statusCode: 200,
      success: true,
      message: this.i18n.t(NOTIFICATION_I18N.PREFERENCES_FETCHED),
      timeStamp: new Date().toISOString(),
      data,
    };
  }

  @Query(() => DeadLetterStatsResponse, {
    description: 'Get dead letter queue (DLQ) failure statistics',
  })
  @Auth([Permission.NOTIFICATION_MANAGE])
  async getNotificationDlqStats(): Promise<{
    statusCode: number;
    success: boolean;
    message: string;
    timeStamp: string;
    data: { totalFailed: number };
  }> {
    const data = await this.notificationAppService.getDlqStats();
    return {
      statusCode: 200,
      success: true,
      message: this.i18n.t(NOTIFICATION_I18N.STATS_FETCHED),
      timeStamp: new Date().toISOString(),
      data,
    };
  }

  @Query(() => [DeadLetterJobDiagnosticsType], {
    description: 'List failed DLQ jobs with detailed diagnostics',
  })
  @Auth([Permission.NOTIFICATION_MANAGE])
  async getNotificationDlqFailedJobs(
    @Args('channel', { type: () => ChannelType, nullable: true })
    channel?: ChannelType,
    @Args('start', { type: () => Int, defaultValue: 0 }) start = 0,
    @Args('end', { type: () => Int, defaultValue: 49 }) end = 49,
  ): Promise<DeadLetterJobDiagnosticsType[]> {
    return this.notificationAppService.getDlqFailedJobs(channel, start, end);
  }

  @Mutation(() => NotificationDispatchResponse, {
    description: 'Replay a dead letter queue job',
  })
  @Auth([Permission.NOTIFICATION_MANAGE])
  async replayNotificationDlqJob(
    @Args('jobId', { type: () => String }) jobId: string,
    @Args('channel', { type: () => ChannelType, nullable: true })
    channel?: ChannelType,
  ): Promise<{
    statusCode: number;
    success: boolean;
    message: string;
    timeStamp: string;
    data: NotificationDispatchPayload;
  }> {
    const data = await this.notificationAppService.replayDlqJob(jobId, channel);
    return {
      statusCode: 200,
      success: true,
      message: this.i18n.t(NOTIFICATION_I18N.JOB_REPLAYED),
      timeStamp: new Date().toISOString(),
      data,
    };
  }

  @Mutation(() => IntResponse, {
    description: 'Purge dead letter queue failed jobs',
  })
  @Auth([Permission.NOTIFICATION_MANAGE])
  async purgeNotificationDlq(
    @Args('channel', { type: () => ChannelType, nullable: true })
    channel?: ChannelType,
  ): Promise<{
    statusCode: number;
    success: boolean;
    message: string;
    timeStamp: string;
    data: number;
  }> {
    const count = await this.notificationAppService.purgeDlq(channel);
    return {
      statusCode: 200,
      success: true,
      message: this.i18n.t(NOTIFICATION_I18N.JOBS_PURGED),
      timeStamp: new Date().toISOString(),
      data: count,
    };
  }
}
