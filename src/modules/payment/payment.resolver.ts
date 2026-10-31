import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { I18nService } from 'nestjs-i18n';
import { CurrentUser } from '@bts-soft/core';
import { PaymentService } from './payment.service.js';
import {
  PaymentTransactionType,
  InitiatePaymentResponse,
  PaymentTransactionResponse,
  PaginatedPaymentTransactionsResponse,
} from './dto/payment.types.js';
import { InitiatePaymentInput, RefundPaymentInput } from './inputs/payment.inputs.js';
import { Auth } from '../../common/decorator/auth.decorator.js';
import { Permission } from '../../common/constant/enum.constant.js';
import { PAYMENT_I18N } from './constants/payment-i18n.constants.js';
import type { IAuthenticatedUser } from '../../common/interfaces/IContext.interface.js';

@Resolver(() => PaymentTransactionType)
export class PaymentResolver {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly i18n: I18nService,
  ) {}

  @Mutation(() => InitiatePaymentResponse)
  @Auth([Permission.PAYMENT_INITIATE])
  async initiatePayment(
    @CurrentUser() currentUser: IAuthenticatedUser,
    @Args('input') input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResponse> {
    const tx = await this.paymentService.initiatePayment(currentUser.id, input);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(PAYMENT_I18N.INITIATE_SUCCESS),
      timeStamp: new Date().toISOString(),
      data: {
        transactionId: tx.id,
        status: tx.status,
        providerTransactionId: tx.providerTransactionId,
        checkoutUrl: tx.checkoutUrl,
        referenceNumber: tx.referenceNumber,
      },
    };
  }

  @Mutation(() => PaymentTransactionResponse)
  @Auth([Permission.PAYMENT_VIEW])
  async verifyPayment(
    @Args('transactionId') transactionId: string,
  ): Promise<PaymentTransactionResponse> {
    const tx = await this.paymentService.verifyPayment(transactionId);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(PAYMENT_I18N.VERIFY_SUCCESS),
      timeStamp: new Date().toISOString(),
      data: tx as unknown as PaymentTransactionType,
    };
  }

  @Mutation(() => PaymentTransactionResponse)
  @Auth([Permission.PAYMENT_MANAGE])
  async refundPayment(
    @CurrentUser() currentUser: IAuthenticatedUser,
    @Args('input') input: RefundPaymentInput,
  ): Promise<PaymentTransactionResponse> {
    const tx = await this.paymentService.refundPayment(currentUser.id, input);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(PAYMENT_I18N.REFUND_SUCCESS),
      timeStamp: new Date().toISOString(),
      data: tx as unknown as PaymentTransactionType,
    };
  }

  @Query(() => PaymentTransactionResponse)
  @Auth([Permission.PAYMENT_VIEW])
  async getPaymentTransaction(
    @Args('id') id: string,
  ): Promise<PaymentTransactionResponse> {
    const tx = await this.paymentService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(PAYMENT_I18N.TRANSACTION_RETRIEVED),
      timeStamp: new Date().toISOString(),
      data: tx as unknown as PaymentTransactionType,
    };
  }

  @Query(() => PaginatedPaymentTransactionsResponse)
  @Auth([Permission.PAYMENT_VIEW])
  async getPaymentTransactions(
    @CurrentUser() currentUser: IAuthenticatedUser,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number,
  ): Promise<PaginatedPaymentTransactionsResponse> {
    const res = await this.paymentService.findAll(page, limit, currentUser.id);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(PAYMENT_I18N.TRANSACTIONS_RETRIEVED),
      timeStamp: new Date().toISOString(),
      data: {
        paginationInfo: {
          totalItems: res.totalItems,
          currentPage: res.currentPage,
          nextPage: res.nextPage,
        },
        items: res.items as unknown as PaymentTransactionType[],
      },
    };
  }
}
