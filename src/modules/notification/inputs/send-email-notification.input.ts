import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsEmail, IsOptional, MaxLength } from 'class-validator';

@InputType()
export class SendEmailNotificationInput {
  @Field(() => String, { description: 'Recipient email address' })
  @IsNotEmpty()
  @IsEmail()
  to: string;

  @Field(() => String, { description: 'Email subject' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  subject: string;

  @Field(() => String, { description: 'Email body (supports plain text or HTML)' })
  @IsNotEmpty()
  @IsString()
  body: string;

  @Field(() => String, { nullable: true, description: 'Optional template name' })
  @IsOptional()
  @IsString()
  templateName?: string;
}
