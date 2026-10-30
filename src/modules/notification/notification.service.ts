import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import {
  NotificationService as CoreNotificationService,
  DeadLetterQueueService,
  type IUserPreferenceRepository,
  USER_PREFERENCE_REPOSITORY,
  ChannelType,
  type NotificationMessage,
  NotificationStatus,
  type NotificationCategory,
} from '@bts-soft/core';
import { I18nService } from 'nestjs-i18n';
import { NotificationMessageFactory } from './factory/notification-message.factory.js';
import { SendNotificationInput } from './inputs/send-notification.input.js';
import { SendEmailNotificationInput } from './inputs/send-email-notification.input.js';
import { UpdateNotificationPreferenceInput } from './inputs/update-preference.input.js';
import {
  DeadLetterJobDiagnosticsType,
  DeadLetterStatsType,
  NotificationDispatchPayload,
  NotificationPreferenceStatusType,
} from './dtos/notification.types.js';
import { NOTIFICATION_I18N } from './constants/notification-i18n.constants.js';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly coreNotificationService: CoreNotificationService,
    private readonly dlqService: DeadLetterQueueService,
    @Inject(USER_PREFERENCE_REPOSITORY)
    private readonly preferenceRepo: IUserPreferenceRepository,
    private readonly messageFactory: NotificationMessageFactory,
    private readonly i18n: I18nService,
  ) {}

  async sendNotification(
    input: SendNotificationInput,
  ): Promise<NotificationDispatchPayload> {
    const isOptedOut = await this.preferenceRepo.isOptedOut(
      input.recipientId,
      input.channel,
      input.category,
    );

    if (isOptedOut) {
      this.logger.warn(
        `Recipient ${input.recipientId} has opted out of channel ${input.channel}`,
      );
      return {
        jobId: 'suppressed-by-preferences',
        channel: input.channel,
        recipientId: input.recipientId,
        status: NotificationStatus.SKIPPED,
      };
    }

    const message: NotificationMessage = this.messageFactory.createMessage({
      recipientId: input.recipientId,
      body: input.body,
      subject: input.subject,
      priority: input.priority,
      category: input.category,
      templateName: input.templateName,
      idempotencyKey: input.idempotencyKey,
    });

    const result = await this.coreNotificationService.sendWithResult(
      input.channel,
      message,
    );

    return {
      jobId: result.jobId || 'direct-dispatch',
      channel: input.channel,
      recipientId: input.recipientId,
      status:
        result.status === 'queued'
          ? NotificationStatus.QUEUED
          : NotificationStatus.SKIPPED,
    };
  }


  async updatePreferences(
    input: UpdateNotificationPreferenceInput,
  ): Promise<NotificationPreferenceStatusType> {
    await this.preferenceRepo.setOptOut(
      input.recipientId,
      input.channel,
      input.optOut,
      input.category,
    );

    return {
      recipientId: input.recipientId,
      channel: input.channel,
      isOptedOut: input.optOut,
    };
  }

  async getPreferenceStatus(
    recipientId: string,
    channel: ChannelType,
    category?: NotificationCategory,
  ): Promise<NotificationPreferenceStatusType> {
    const isOptedOut = await this.preferenceRepo.isOptedOut(
      recipientId,
      channel,
      category,
    );

    return {
      recipientId,
      channel,
      isOptedOut,
    };
  }

  // DLQ

  async getDlqStats(): Promise<DeadLetterStatsType> {
    const stats = await this.dlqService.getStats();
    return {
      totalFailed: stats.totalFailed,
    };
  }

  async getDlqFailedJobs(
    channel?: ChannelType,
    start = 0,
    end = 49,
  ): Promise<DeadLetterJobDiagnosticsType[]> {
    const jobs = await this.dlqService.listFailedJobs(channel, start, end);
    return jobs.map((j) => ({
      jobId: j.jobId,
      channel: String(j.channel),
      recipientRef: j.recipientRef,
      failedReason: j.failedReason,
      attemptsMade: j.attemptsMade,
      failedAt: j.failedAt,
    }));
  }

  async replayDlqJob(
    jobId: string,
    channel?: ChannelType,
  ): Promise<NotificationDispatchPayload> {
    try {
      const res = await this.dlqService.replayJob(jobId, channel);
      return {
        jobId: res.jobId || jobId,
        channel: channel || ChannelType.EMAIL,
        recipientId: 'replayed',
        status:
          res.status === 'queued'
            ? NotificationStatus.QUEUED
            : NotificationStatus.SKIPPED,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to replay DLQ job ${jobId}: ${msg}`);
      throw new NotFoundException(this.i18n.t(NOTIFICATION_I18N.NOT_FOUND));
    }
  }

  async purgeDlq(channel?: ChannelType): Promise<number> {
    const res = await this.dlqService.purge(channel);
    return res.purgedCount;
  }

  // Helper
  async sendEmail(
    input: SendEmailNotificationInput,
  ): Promise<NotificationDispatchPayload> {
    return this.sendNotification({
      channel: ChannelType.EMAIL,
      recipientId: input.to,
      subject: input.subject,
      body: input.body,
      templateName: input.templateName,
    });
  }
}
