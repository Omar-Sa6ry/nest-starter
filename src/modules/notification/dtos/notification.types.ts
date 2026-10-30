import { ObjectType, Field, Int } from '@nestjs/graphql';
import { ChannelType, NotificationStatus } from '@bts-soft/core';

@ObjectType()
export class NotificationLogType {
  @Field(() => String)
  id: string;

  @Field(() => String)
  jobId: string;

  @Field(() => ChannelType)
  channel: ChannelType;

  @Field(() => String)
  recipientId: string;

  @Field(() => NotificationStatus)
  status: NotificationStatus;

  @Field(() => String, { nullable: true })
  errorMessage?: string;

  @Field(() => String, { nullable: true })
  providerMessageId?: string;

  @Field(() => String, { nullable: true })
  provider?: string;

  @Field(() => Int, { nullable: true })
  durationMs?: number;

  @Field(() => Int)
  attemptsMade: number;

  @Field(() => Date)
  createdAt: Date;
}

@ObjectType()
export class NotificationDispatchPayload {
  @Field(() => String)
  jobId: string;

  @Field(() => ChannelType)
  channel: ChannelType;

  @Field(() => String)
  recipientId: string;

  @Field(() => NotificationStatus)
  status: NotificationStatus;

  @Field(() => String, { nullable: true })
  providerMessageId?: string;
}

@ObjectType()
export class DeadLetterJobDiagnosticsType {
  @Field(() => String)
  jobId: string;

  @Field(() => String)
  channel: string;

  @Field(() => String)
  recipientRef: string;

  @Field(() => String, { nullable: true })
  failedReason?: string;

  @Field(() => Int)
  attemptsMade: number;

  @Field(() => Date, { nullable: true })
  failedAt?: Date;
}

@ObjectType()
export class DeadLetterStatsType {
  @Field(() => Int)
  totalFailed: number;
}

@ObjectType()
export class NotificationPreferenceStatusType {
  @Field(() => String)
  recipientId: string;

  @Field(() => ChannelType)
  channel: ChannelType;

  @Field(() => Boolean)
  isOptedOut: boolean;
}
