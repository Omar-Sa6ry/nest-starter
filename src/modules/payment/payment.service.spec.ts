import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentService } from './payment.service.js';
import { PaymentProvider } from './enums/payment-provider.enum.js';
import { PaymentStatus } from './enums/payment-status.enum.js';
import { PaymentCurrency } from './enums/payment-currency.enum.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { PaymentTransaction } from './entity/payment-transaction.entity.js';
import type { PaymentStrategyFactory } from './strategies/payment-strategy.factory.js';
import type { MetricsService } from '../../common/metrics/metrics.service.js';

describe('PaymentService', () => {
  let service: PaymentService;
  let mockRepo: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let mockFactory: {
    getStrategy: ReturnType<typeof vi.fn>;
    registerStrategy: ReturnType<typeof vi.fn>;
    getSupportedProviders: ReturnType<typeof vi.fn>;
  };
  let mockMetrics: {
    requestCounter: { inc: ReturnType<typeof vi.fn> };
    errorCounter: { inc: ReturnType<typeof vi.fn> };
  };
  let mockStrategy: {
    provider: PaymentProvider;
    initiatePayment: ReturnType<typeof vi.fn>;
    verifyPayment: ReturnType<typeof vi.fn>;
    refundPayment: ReturnType<typeof vi.fn>;
    verifyAndParseWebhook: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockStrategy = {
      provider: PaymentProvider.STRIPE,
      initiatePayment: vi.fn().mockResolvedValue({
        providerTransactionId: 'pi_test_123',
        checkoutUrl: 'https://checkout.stripe.com/pay',
        referenceNumber: 'REF123',
        status: PaymentStatus.PENDING,
        rawResponse: { debug: true },
      }),
      verifyPayment: vi.fn().mockResolvedValue({
        providerTransactionId: 'pi_test_123',
        status: PaymentStatus.COMPLETED,
        amountPaid: 100,
        rawResponse: { verified: true },
      }),
      refundPayment: vi.fn().mockResolvedValue({
        refundId: 're_test_123',
        status: PaymentStatus.REFUNDED,
        rawResponse: { refund: true },
      }),
      verifyAndParseWebhook: vi.fn().mockResolvedValue({
        isValid: true,
        event: 'charge.succeeded',
        transactionId: 'tx_123',
        status: PaymentStatus.COMPLETED,
        rawPayload: { event: 'charge.succeeded' },
      }),
    };

    mockFactory = {
      getStrategy: vi.fn().mockReturnValue(mockStrategy),
      registerStrategy: vi.fn(),
      getSupportedProviders: vi.fn().mockReturnValue([PaymentProvider.STRIPE]),
    };

    mockRepo = {
      create: vi.fn().mockImplementation((dto) => ({ ...dto })),
      save: vi.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
      }),
    };

    mockMetrics = {
      requestCounter: { inc: vi.fn() },
      errorCounter: { inc: vi.fn() },
    };

    service = new PaymentService(
      mockRepo as unknown as Repository<PaymentTransaction>,
      mockFactory as unknown as PaymentStrategyFactory,
      mockMetrics as unknown as MetricsService,
    );
  });

  describe('initiatePayment', () => {
    it('should initiate payment successfully and save transaction with rawResponse', async () => {
      const input = {
        amount: 100,
        currency: PaymentCurrency.USD,
        provider: PaymentProvider.STRIPE,
        customer: { name: 'Omar', email: 'omar@example.com' },
      };

      const result = await service.initiatePayment('user-1', input);

      expect(result.id).toBeDefined();
      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(result.providerTransactionId).toBe('pi_test_123');
      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/pay');
      expect(result.referenceNumber).toBe('REF123');
      expect(result.metadata).toEqual({ initiationResponse: { debug: true } });
      expect(mockMetrics.requestCounter.inc).toHaveBeenCalled();
    });

    it('should handle initiation failure, mark transaction as FAILED, and rethrow BadRequestException', async () => {
      mockStrategy.initiatePayment.mockRejectedValueOnce(new Error('Card declined'));

      const input = {
        amount: 100,
        currency: PaymentCurrency.USD,
        provider: PaymentProvider.STRIPE,
        customer: { name: 'Omar', email: 'omar@example.com' },
      };

      await expect(service.initiatePayment('user-1', input)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockMetrics.errorCounter.inc).toHaveBeenCalled();
    });

    it('should handle non-Error initiation throw', async () => {
      mockStrategy.initiatePayment.mockRejectedValueOnce('string error');

      const input = {
        amount: 100,
        currency: PaymentCurrency.USD,
        provider: PaymentProvider.STRIPE,
        customer: { name: 'Omar', email: 'omar@example.com' },
      };

      await expect(service.initiatePayment('user-1', input)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyPayment', () => {
    it('should throw NotFoundException if transaction is not found', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.verifyPayment('tx_non_existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return immediately if transaction is already COMPLETED', async () => {
      const completedTx = {
        id: 'tx_123',
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
      };
      mockRepo.findOne.mockResolvedValueOnce(completedTx);

      const res = await service.verifyPayment('tx_123');
      expect(res.status).toBe(PaymentStatus.COMPLETED);
      expect(mockStrategy.verifyPayment).not.toHaveBeenCalled();
    });

    it('should verify payment and update transaction status and metadata', async () => {
      const pendingTx = {
        id: 'tx_123',
        status: PaymentStatus.PENDING,
        provider: PaymentProvider.STRIPE,
        providerTransactionId: 'pi_test_123',
        metadata: {},
      };
      mockRepo.findOne.mockResolvedValueOnce(pendingTx);

      const res = await service.verifyPayment('tx_123');
      expect(res.status).toBe(PaymentStatus.COMPLETED);
      expect(mockRepo.save).toHaveBeenCalled();
      expect(mockMetrics.requestCounter.inc).toHaveBeenCalled();
    });

    it('should record failureReason if verification fails with reason', async () => {
      const pendingTx = {
        id: 'tx_123',
        status: PaymentStatus.PENDING,
        provider: PaymentProvider.STRIPE,
        providerTransactionId: 'pi_test_123',
        metadata: {},
      };
      mockRepo.findOne.mockResolvedValueOnce(pendingTx);
      mockStrategy.verifyPayment.mockResolvedValueOnce({
        providerTransactionId: 'pi_test_123',
        status: PaymentStatus.FAILED,
        failureReason: 'Fraud detected',
      });

      const res = await service.verifyPayment('tx_123');
      expect(res.status).toBe(PaymentStatus.FAILED);
      expect(res.failureReason).toBe('Fraud detected');
    });
  });

  describe('refundPayment', () => {
    it('should throw NotFoundException if transaction not found', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.refundPayment('u1', { transactionId: 'tx_123' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if transaction is not COMPLETED', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        id: 'tx_123',
        status: PaymentStatus.PENDING,
      });

      await expect(
        service.refundPayment('u1', { transactionId: 'tx_123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should refund completed payment successfully', async () => {
      const completedTx = {
        id: 'tx_123',
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
        providerTransactionId: 'pi_test_123',
        metadata: {},
      };
      mockRepo.findOne.mockResolvedValueOnce(completedTx);

      const res = await service.refundPayment('u1', {
        transactionId: 'tx_123',
        amount: 50,
        reason: 'Customer return',
      });

      expect(res.status).toBe(PaymentStatus.REFUNDED);
      expect(res.metadata?.refundId).toBe('re_test_123');
      expect(mockMetrics.requestCounter.inc).toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    it('should return processed false if webhook signature is invalid', async () => {
      mockStrategy.verifyAndParseWebhook.mockResolvedValueOnce({
        isValid: false,
      });

      const res = await service.handleWebhook(PaymentProvider.STRIPE, {}, {});
      expect(res.processed).toBe(false);
    });

    it('should update transaction on valid webhook matching transactionId', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        id: 'tx_123',
        status: PaymentStatus.PENDING,
        metadata: {},
      });

      const res = await service.handleWebhook(
        PaymentProvider.STRIPE,
        { 'stripe-signature': 'sig' },
        {},
      );

      expect(res.processed).toBe(true);
      expect(res.transactionId).toBe('tx_123');
      expect(res.status).toBe(PaymentStatus.COMPLETED);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should look up transaction by providerTransactionId if transactionId not found', async () => {
      mockStrategy.verifyAndParseWebhook.mockResolvedValueOnce({
        isValid: true,
        event: 'charge.succeeded',
        providerTransactionId: 'pi_test_123',
        status: PaymentStatus.COMPLETED,
        rawPayload: {},
      });
      mockRepo.findOne.mockResolvedValueOnce({
        id: 'tx_123',
        providerTransactionId: 'pi_test_123',
        status: PaymentStatus.PENDING,
        metadata: {},
      });

      const res = await service.handleWebhook(PaymentProvider.STRIPE, {}, {});
      expect(res.processed).toBe(true);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find transaction by ID', async () => {
      mockRepo.findOne.mockResolvedValueOnce({ id: 'tx_123', amount: 100 });
      const tx = await service.findById('tx_123');
      expect(tx.id).toBe('tx_123');
    });

    it('should throw NotFoundException if transaction is missing', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findById('non_existing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated transactions with user filtering', async () => {
      const result = await service.findAll(1, 10, 'user-1');

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
      expect(result.currentPage).toBe(1);
    });

    it('should return paginated transactions without user filter and compute nextPage', async () => {
      mockRepo.createQueryBuilder.mockReturnValueOnce({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[{ id: 'tx_1' }], 20]),
      });

      const result = await service.findAll(1, 10);
      expect(result.items).toHaveLength(1);
      expect(result.totalItems).toBe(20);
      expect(result.nextPage).toBe(2);
    });
  });
});
