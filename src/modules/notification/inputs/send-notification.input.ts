import { InputType, Field } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
} from 'class-validator';
import {
  ChannelType,
  NotificationPriority,
  NotificationCategory,
} from '@bts-soft/core';

@InputType()
export class SendNotificationInput {
  @Field(() => ChannelType, { description: 'Target delivery channel' })
  @IsNotEmpty()
  @IsEnum(ChannelType)
  channel: ChannelType;

  @Field(() => String, { description: 'Recipient identifier (email, phone, user id)' })
  @IsNotEmpty()
  @IsString()
  recipientId: string;

  @Field(() => String, { nullable: true, description: 'Subject of the message' })
  @IsOptional()
  @IsString()
  subject?: string;

  @Field(() => String, { description: 'Content/body of the notification' })
  @IsNotEmpty()
  @IsString()
  body: string;

  @Field(() => NotificationPriority, {
    nullable: true,
    defaultValue: NotificationPriority.NORMAL,
    description: 'Priority level for processing',
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @Field(() => NotificationCategory, {
    nullable: true,
    defaultValue: NotificationCategory.TRANSACTIONAL,
    description: 'Category of notification (e.g. transactional, promotional)',
  })
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @Field(() => String, { nullable: true, description: 'Optional template name' })
  @IsOptional()
  @IsString()
  templateName?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Idempotency deduplication key',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  context?: Record<string, unknown>;
}
