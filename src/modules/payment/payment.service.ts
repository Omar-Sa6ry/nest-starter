import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdGenerator } from '@bts-soft/core';
import { PaymentTransaction } from './entity/payment-transaction.entity.js';
import { PaymentStrategyFactory } from './strategies/payment-strategy.factory.js';
import {
  InitiatePaymentInput,
  RefundPaymentInput,
} from './inputs/payment.inputs.js';
import { PaymentStatus } from './enums/payment-status.enum.js';
import { PaymentProvider } from './enums/payment-provider.enum.js';
import { MetricsService } from '../../common/metrics/metrics.service.js';
import { PAYMENT_METRICS_LABELS } from './constants/payment.constants.js';
import { PaginatedResult } from '../auth/interfaces/IPaginationResult.interface.js';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly transactionRepository: Repository<PaymentTransaction>,
    private readonly strategyFactory: PaymentStrategyFactory,
    private readonly metricsService: MetricsService,
  ) {}

  async initiatePayment(
    userId: string,
    input: InitiatePaymentInput,
  ): Promise<PaymentTransaction> {
    const strategy = this.strategyFactory.getStrategy(input.provider);
    const transactionId = IdGenerator.generate('snowflake');

    const transaction = this.transactionRepository.create({
      id: transactionId,
      userId,
      amount: input.amount,
      currency: input.currency,
      provider: input.provider,
      status: PaymentStatus.PENDING,
      metadata: {},
    });

    await this.transactionRepository.save(transaction);

    try {
      const result = await strategy.initiatePayment({
        transactionId,
        amount: input.amount,
        currency: input.currency,
        customer: input.customer,
        items: input.items,
        returnUrl: input.returnUrl,
        cancelUrl: input.cancelUrl,
      });

      transaction.providerTransactionId = result.providerTransactionId;
      transaction.checkoutUrl = result.checkoutUrl;
      transaction.referenceNumber = result.referenceNumber;
      transaction.status = result.status;
      if (result.rawResponse) {
        transaction.metadata = {
          ...transaction.metadata,
          initiationResponse: result.rawResponse,
        };
      }

      await this.transactionRepository.save(transaction);

      this.metricsService.requestCounter.inc({
        protocol: 'internal',
        method: PAYMENT_METRICS_LABELS.INITIATE,
        path: input.provider,
        statusCode: '200',
      });

      return transaction;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown payment initiation error';
      transaction.status = PaymentStatus.FAILED;
      transaction.failureReason = errorMessage;
      await this.transactionRepository.save(transaction);

      this.metricsService.errorCounter.inc({
        context: 'PaymentService:initiatePayment',
        errorCode: 'INITIATION_FAILED',
      });

      throw new BadRequestException(errorMessage);
    }
  }

  async verifyPayment(transactionId: string): Promise<PaymentTransaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
    });
    if (!transaction)
      throw new NotFoundException(
        `Payment transaction '${transactionId}' not found`,
      );

    if (transaction.status === PaymentStatus.COMPLETED) return transaction;

    const strategy = this.strategyFactory.getStrategy(transaction.provider);
    const lookupId = transaction.providerTransactionId || transaction.id;

    const verification = await strategy.verifyPayment(lookupId);

    transaction.status = verification.status;
    if (verification.failureReason)
      transaction.failureReason = verification.failureReason;

    if (verification.rawResponse) {
      transaction.metadata = {
        ...transaction.metadata,
        verifyResponse: verification.rawResponse,
      };
    }

    await this.transactionRepository.save(transaction);

    this.metricsService.requestCounter.inc({
      protocol: 'internal',
      method: PAYMENT_METRICS_LABELS.VERIFY,
      path: transaction.provider,
      statusCode: '200',
    });

    return transaction;
  }

  async refundPayment(
    userId: string,
    input: RefundPaymentInput,
  ): Promise<PaymentTransaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: input.transactionId },
    });
    if (!transaction) {
      throw new NotFoundException(
        `Payment transaction '${input.transactionId}' not found`,
      );
    }

    if (transaction.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException(
        'Only completed transactions can be refunded',
      );
    }

    const strategy = this.strategyFactory.getStrategy(transaction.provider);
    const targetTransactionId =
      transaction.providerTransactionId || transaction.id;

    const result = await strategy.refundPayment({
      providerTransactionId: targetTransactionId,
      amount: input.amount,
      reason: input.reason,
    });

    transaction.status = result.status;
    transaction.metadata = {
      ...transaction.metadata,
      refundedBy: userId,
      refundId: result.refundId,
      refundResponse: result.rawResponse,
    };

    await this.transactionRepository.save(transaction);

    this.metricsService.requestCounter.inc({
      protocol: 'internal',
      method: PAYMENT_METRICS_LABELS.REFUND,
      path: transaction.provider,
      statusCode: '200',
    });

    return transaction;
  }

  async handleWebhook(
    provider: PaymentProvider,
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer | string | Record<string, unknown>,
  ): Promise<{
    processed: boolean;
    transactionId?: string;
    status?: PaymentStatus;
  }> {
    const strategy = this.strategyFactory.getStrategy(provider);
    const parseResult = await strategy.verifyAndParseWebhook(headers, rawBody);

    if (!parseResult.isValid) {
      this.logger.warn(`Invalid webhook for provider ${provider}`);
      return { processed: false };
    }

    let transaction: PaymentTransaction | null = null;
    if (parseResult.transactionId)
      transaction = await this.transactionRepository.findOne({
        where: { id: parseResult.transactionId },
      });

    if (!transaction && parseResult.providerTransactionId)
      transaction = await this.transactionRepository.findOne({
        where: { providerTransactionId: parseResult.providerTransactionId },
      });

    if (transaction) {
      transaction.status = parseResult.status;
      transaction.metadata = {
        ...transaction.metadata,
        lastWebhookEvent: parseResult.event,
        lastWebhookPayload: parseResult.rawPayload,
      };
      await this.transactionRepository.save(transaction);
      this.logger.log(
        `Webhook updated transaction ${transaction.id} to status ${transaction.status}`,
      );
    }

    this.metricsService.requestCounter.inc({
      protocol: 'http',
      method: PAYMENT_METRICS_LABELS.WEBHOOK,
      path: `/webhooks/payment/${provider.toLowerCase()}`,
      statusCode: '200',
    });

    return {
      processed: true,
      transactionId: transaction?.id,
      status: parseResult.status,
    };
  }

  async findById(id: string): Promise<PaymentTransaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
    });
    if (!transaction) {
      throw new NotFoundException(`Payment transaction '${id}' not found`);
    }
    return transaction;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    userId?: string,
  ): Promise<PaginatedResult<PaymentTransaction>> {
    const skip = (page - 1) * limit;
    const query = this.transactionRepository.createQueryBuilder('tx');

    if (userId) {
      query.where('tx.userId = :userId', { userId });
    }

    query.orderBy('tx.createdAt', 'DESC').skip(skip).take(limit);

    const [items, totalItems] = await query.getManyAndCount();
    const hasNext = skip + items.length < totalItems;

    return {
      items,
      totalItems,
      currentPage: page,
      nextPage: hasNext ? page + 1 : undefined,
    };
  }
}
