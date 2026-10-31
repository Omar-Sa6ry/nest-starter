import { InputType, Field, Float } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsNumber, IsPositive, IsEnum, IsOptional, ValidateNested, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentProvider } from '../enums/payment-provider.enum.js';
import { PaymentCurrency } from '../enums/payment-currency.enum.js';

@InputType()
export class CustomerInfoInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  name: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  email: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;
}

@InputType()
export class PaymentItemInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  name: string;

  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  quantity: number;

  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  unitAmount: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}

@InputType()
export class InitiatePaymentInput {
  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  amount: number;

  @Field(() => PaymentCurrency, { defaultValue: PaymentCurrency.USD })
  @IsEnum(PaymentCurrency)
  currency: PaymentCurrency = PaymentCurrency.USD;

  @Field(() => PaymentProvider)
  @IsEnum(PaymentProvider)
  provider: PaymentProvider;

  @Field(() => CustomerInfoInput)
  @ValidateNested()
  @Type(() => CustomerInfoInput)
  customer: CustomerInfoInput;

  @Field(() => [PaymentItemInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PaymentItemInput)
  items?: PaymentItemInput[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUrl({ require_tld: false })
  returnUrl?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUrl({ require_tld: false })
  cancelUrl?: string;
}

@InputType()
export class RefundPaymentInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}
