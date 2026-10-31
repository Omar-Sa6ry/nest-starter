import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentResolver } from './payment.resolver.js';
import { PaymentProvider } from './enums/payment-provider.enum.js';
import { PaymentStatus } from './enums/payment-status.enum.js';
import { PaymentCurrency } from './enums/payment-currency.enum.js';
import { Role, Permission } from '../../common/constant/enum.constant.js';
import type { IAuthenticatedUser } from '../../common/interfaces/IContext.interface.js';
import type { PaymentService } from './payment.service.js';
import type { I18nService } from 'nestjs-i18n';

describe('PaymentResolver', () => {
  let resolver: PaymentResolver;
  let mockPaymentService: {
    initiatePayment: ReturnType<typeof vi.fn>;
    verifyPayment: ReturnType<typeof vi.fn>;
    refundPayment: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
  };
  let mockI18n: {
    t: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPaymentService = {
      initiatePayment: vi.fn().mockResolvedValue({
        id: 'tx_123',
        status: PaymentStatus.PENDING,
        providerTransactionId: 'pi_123',
        checkoutUrl: 'https://checkout.stripe.com',
        referenceNumber: 'REF123',
      }),
      verifyPayment: vi.fn().mockResolvedValue({
        id: 'tx_123',
        status: PaymentStatus.COMPLETED,
      }),
      refundPayment: vi.fn().mockResolvedValue({
        id: 'tx_123',
        status: PaymentStatus.REFUNDED,
      }),
      findById: vi.fn().mockResolvedValue({
        id: 'tx_123',
        status: PaymentStatus.COMPLETED,
      }),
      findAll: vi.fn().mockResolvedValue({
        items: [],
        totalItems: 0,
        currentPage: 1,
        nextPage: undefined,
      }),
    };

    mockI18n = {
      t: vi.fn().mockResolvedValue('Translated Message'),
    };

    resolver = new PaymentResolver(
      mockPaymentService as unknown as PaymentService,
      mockI18n as unknown as I18nService,
    );
  });

  it('should return standardized response for initiatePayment', async () => {
    const user: IAuthenticatedUser = {
      id: 'u1',
      email: 'test@test.com',
      role: Role.USER,
      permissions: [Permission.PAYMENT_INITIATE],
    };
    const input = {
      amount: 100,
      currency: PaymentCurrency.USD,
      provider: PaymentProvider.STRIPE,
      customer: { name: 'Omar', email: 'omar@test.com' },
    };

    const res = await resolver.initiatePayment(user, input);

    expect(res.success).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.message).toBe('Translated Message');
    expect(res.data?.transactionId).toBe('tx_123');
  });

  it('should return standardized response for verifyPayment', async () => {
    const res = await resolver.verifyPayment('tx_123');

    expect(res.success).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.data?.id).toBe('tx_123');
  });

  it('should return standardized response for getPaymentTransactions pagination', async () => {
    const user: IAuthenticatedUser = {
      id: 'u1',
      email: 'test@test.com',
      role: Role.USER,
      permissions: [Permission.PAYMENT_VIEW],
    };
    const res = await resolver.getPaymentTransactions(user, 1, 10);

    expect(res.success).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.data?.paginationInfo.currentPage).toBe(1);
  });
});
