import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { ChannelType, NotificationCategory } from '@bts-soft/core';

@InputType()
export class UpdateNotificationPreferenceInput {
  @Field(() => String, { description: 'Target user/recipient ID' })
  @IsNotEmpty()
  @IsString()
  recipientId: string;

  @Field(() => ChannelType, { description: 'Notification channel to update' })
  @IsNotEmpty()
  @IsEnum(ChannelType)
  channel: ChannelType;

  @Field(() => Boolean, {
    description: 'True to opt out (suppress notifications), False to opt in',
  })
  @IsNotEmpty()
  @IsBoolean()
  optOut: boolean;

  @Field(() => NotificationCategory, {
    nullable: true,
    description: 'Specific category to opt out from (optional)',
  })
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;
}
