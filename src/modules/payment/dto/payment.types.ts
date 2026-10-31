import { ObjectType, Field, Float } from '@nestjs/graphql';
import { PaymentProvider } from '../enums/payment-provider.enum.js';
import { PaymentStatus } from '../enums/payment-status.enum.js';
import { PaymentCurrency } from '../enums/payment-currency.enum.js';
import { GeneralResponse, PaginatedResponse } from '../../../common/graphql/general-response.type.js';

@ObjectType()
export class PaymentTransactionType {
  @Field(() => String)
  id: string;

  @Field(() => String)
  userId: string;

  @Field(() => Float)
  amount: number;

  @Field(() => PaymentCurrency)
  currency: PaymentCurrency;

  @Field(() => PaymentProvider)
  provider: PaymentProvider;

  @Field(() => PaymentStatus)
  status: PaymentStatus;

  @Field(() => String, { nullable: true })
  providerTransactionId?: string;

  @Field(() => String, { nullable: true })
  checkoutUrl?: string;

  @Field(() => String, { nullable: true })
  referenceNumber?: string;

  @Field(() => String, { nullable: true })
  failureReason?: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class InitiatePaymentDataType {
  @Field(() => String)
  transactionId: string;

  @Field(() => PaymentStatus)
  status: PaymentStatus;

  @Field(() => String, { nullable: true })
  providerTransactionId?: string;

  @Field(() => String, { nullable: true })
  checkoutUrl?: string;

  @Field(() => String, { nullable: true })
  referenceNumber?: string;
}

@ObjectType()
export class InitiatePaymentResponse extends GeneralResponse(InitiatePaymentDataType) {}

@ObjectType()
export class PaymentTransactionResponse extends GeneralResponse(PaymentTransactionType) {}

@ObjectType()
export class PaginatedPaymentTransactionsResponse extends PaginatedResponse(PaymentTransactionType) {}
