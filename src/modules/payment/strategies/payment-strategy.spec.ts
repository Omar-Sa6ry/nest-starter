import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StripeStrategy } from './stripe.strategy.js';
import { FawryStrategy } from './fawry.strategy.js';
import { PaymobStrategy } from './paymob.strategy.js';
import { PaypalStrategy } from './paypal.strategy.js';
import { PaymentStrategyFactory } from './payment-strategy.factory.js';
import { PaymentProvider } from '../enums/payment-provider.enum.js';
import { PaymentStatus } from '../enums/payment-status.enum.js';
import { PaymentCurrency } from '../enums/payment-currency.enum.js';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

describe('Payment Strategies & Factory', () => {
  let mockConfigService: {
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: string) => {
        const configMap: Record<string, string> = {
          STRIPE_SECRET_KEY: 'sk_test_123',
          STRIPE_WEBHOOK_SECRET: 'whsec_123',
          FAWRY_MERCHANT_CODE: '1000000001',
          FAWRY_SECURITY_KEY: 'fawry_secret',
          FAWRY_BASE_URL: 'https://atfawry.fawrystaging.com',
          PAYMOB_API_KEY: 'paymob_key',
          PAYMOB_HMAC_SECRET: 'paymob_hmac',
          PAYMOB_INTEGRATION_ID: '12345',
          PAYMOB_IFRAME_ID: '67890',
          PAYPAL_CLIENT_ID: 'pp_client',
          PAYPAL_CLIENT_SECRET: 'pp_secret',
          PAYPAL_BASE_URL: 'https://api-m.sandbox.paypal.com',
        };
        return configMap[key] || defaultValue || '';
      }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('PaymentStrategyFactory', () => {
    it('should register and return strategies correctly', () => {
      const stripe = new StripeStrategy(mockConfigService as unknown as ConfigService);
      const fawry = new FawryStrategy(mockConfigService as unknown as ConfigService);
      const paymob = new PaymobStrategy(mockConfigService as unknown as ConfigService);
      const paypal = new PaypalStrategy(mockConfigService as unknown as ConfigService);

      const factory = new PaymentStrategyFactory(stripe, fawry, paymob, paypal);

      expect(factory.getStrategy(PaymentProvider.STRIPE)).toBe(stripe);
      expect(factory.getStrategy(PaymentProvider.FAWRY)).toBe(fawry);
      expect(factory.getStrategy(PaymentProvider.PAYMOB)).toBe(paymob);
      expect(factory.getStrategy(PaymentProvider.PAYPAL)).toBe(paypal);

      const supported = factory.getSupportedProviders();
      expect(supported).toContain(PaymentProvider.STRIPE);
      expect(supported).toContain(PaymentProvider.FAWRY);

      // Register custom / override
      factory.registerStrategy(PaymentProvider.STRIPE, stripe);
      expect(factory.getStrategy(PaymentProvider.STRIPE)).toBe(stripe);
    });

    it('should throw BadRequestException for unsupported provider in factory', () => {
      const stripe = new StripeStrategy(mockConfigService as unknown as ConfigService);
      const fawry = new FawryStrategy(mockConfigService as unknown as ConfigService);
      const paymob = new PaymobStrategy(mockConfigService as unknown as ConfigService);
      const paypal = new PaypalStrategy(mockConfigService as unknown as ConfigService);
      const factory = new PaymentStrategyFactory(stripe, fawry, paymob, paypal);

      expect(() => factory.getStrategy('UNKNOWN' as PaymentProvider)).toThrow(BadRequestException);
    });
  });

  describe('StripeStrategy', () => {
    let strategy: StripeStrategy;

    beforeEach(() => {
      strategy = new StripeStrategy(mockConfigService as unknown as ConfigService);
    });

    it('should fallback to mock initiation when secret key is missing', async () => {
      const emptyConfig = { get: vi.fn().mockReturnValue('') };
      const emptyStripe = new StripeStrategy(emptyConfig as unknown as ConfigService);

      const res = await emptyStripe.initiatePayment({
        transactionId: 'tx_123',
        amount: 100,
        currency: PaymentCurrency.USD,
        customer: { name: 'Omar', email: 'omar@example.com' },
      });

      expect(res.providerTransactionId).toContain('cs_mock_');
      expect(res.checkoutUrl).toContain('https://checkout.stripe.com');
      expect(res.status).toBe(PaymentStatus.PENDING);
    });

    it('should call Stripe API successfully during initiatePayment', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'cs_live_123', url: 'https://checkout.stripe.com/pay' }),
      } as unknown as Response);

      const res = await strategy.initiatePayment({
        transactionId: 'tx_123',
        amount: 100,
        currency: PaymentCurrency.USD,
        customer: { name: 'Omar', email: 'omar@example.com' },
        items: [{ name: 'Item 1', quantity: 1, unitAmount: 100 }],
        returnUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
      });

      expect(res.providerTransactionId).toBe('cs_live_123');
      expect(res.checkoutUrl).toBe('https://checkout.stripe.com/pay');
      expect(res.status).toBe(PaymentStatus.PENDING);
    });

    it('should handle Stripe API error response on initiate', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: 'Invalid API Key' } }),
      } as unknown as Response);

      await expect(
        strategy.initiatePayment({
          transactionId: 'tx_123',
          amount: 100,
          currency: PaymentCurrency.USD,
          customer: { name: 'Omar', email: 'omar@example.com' },
        }),
      ).rejects.toThrow('Invalid API Key');
    });

    it('should handle network/fetch failure on initiate', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        strategy.initiatePayment({
          transactionId: 'tx_123',
          amount: 100,
          currency: PaymentCurrency.USD,
          customer: { name: 'Omar', email: 'omar@example.com' },
        }),
      ).rejects.toThrow('Network error');
    });

    it('should verify payment successfully when paid', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'cs_123',
          payment_status: 'paid',
          amount_total: 10000,
          currency: 'usd',
        }),
      } as unknown as Response);

      const res = await strategy.verifyPayment('cs_123');
      expect(res.status).toBe(PaymentStatus.COMPLETED);
      expect(res.amountPaid).toBe(100);
      expect(res.currency).toBe('USD');
    });

    it('should return mock verify when secret key is empty', async () => {
      const emptyConfig = { get: vi.fn().mockReturnValue('') };
      const emptyStripe = new StripeStrategy(emptyConfig as unknown as ConfigService);

      const res = await emptyStripe.verifyPayment('cs_mock_123');
      expect(res.status).toBe(PaymentStatus.COMPLETED);
      expect(res.amountPaid).toBe(100);
      expect(res.currency).toBe('USD');
    });

    it('should return FAILED status when Stripe verify payment_status is unpaid', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'cs_123',
          payment_status: 'unpaid',
        }),
      } as unknown as Response);

      const res = await strategy.verifyPayment('cs_123');
      expect(res.status).toBe(PaymentStatus.FAILED);
    });

    it('should handle Stripe verify failure response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: 'Session not found' } }),
      } as unknown as Response);

      const res = await strategy.verifyPayment('cs_123');
      expect(res.status).toBe(PaymentStatus.FAILED);
      expect(res.failureReason).toContain('Session not found');
    });

    it('should refund payment successfully via Stripe API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 're_123' }),
      } as unknown as Response);

      const res = await strategy.refundPayment({
        providerTransactionId: 'pi_123',
        amount: 50,
        reason: 'requested_by_customer',
      });
      expect(res.status).toBe(PaymentStatus.REFUNDED);
      expect(res.refundId).toBe('re_123');
    });

    it('should return mock refund when secret key is empty', async () => {
      const emptyConfig = { get: vi.fn().mockReturnValue('') };
      const emptyStripe = new StripeStrategy(emptyConfig as unknown as ConfigService);

      const res = await emptyStripe.refundPayment({ providerTransactionId: 'pi_123' });
      expect(res.status).toBe(PaymentStatus.REFUNDED);
      expect(res.refundId).toContain('re_mock_');
    });

    it('should throw Error when Stripe refund fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Stripe refund failed'));

      await expect(
        strategy.refundPayment({ providerTransactionId: 'pi_123' }),
      ).rejects.toThrow('Stripe refund failed');
    });

    it('should parse webhook for checkout.session.completed and payment_intent.payment_failed', async () => {
      const sessionCompleted = await strategy.verifyAndParseWebhook(
        { 'stripe-signature': 'sig_123' },
        JSON.stringify({
          type: 'checkout.session.completed',
          data: { object: { id: 'cs_123', client_reference_id: 'tx_123' } },
        }),
      );
      expect(sessionCompleted.isValid).toBe(true);
      expect(sessionCompleted.status).toBe(PaymentStatus.COMPLETED);
      expect(sessionCompleted.transactionId).toBe('tx_123');
      expect(sessionCompleted.providerTransactionId).toBe('cs_123');

      const paymentFailed = await strategy.verifyAndParseWebhook(
        { 'stripe-signature': 'sig_123' },
        {
          type: 'payment_intent.payment_failed',
          data: { object: { id: 'pi_fail_123', client_reference_id: 'tx_456' } },
        },
      );
      expect(paymentFailed.status).toBe(PaymentStatus.FAILED);
    });

    it('should support customer vault and subscriptions capabilities', async () => {
      const vault = await strategy.saveCustomerPaymentMethod('cust_1', 'tok_12345678');
      expect(vault.paymentMethodId).toBe('pm_cust_1_tok_1234');

      const sub = await strategy.createSubscription('cust_1', 'plan_pro');
      expect(sub.subscriptionId).toBe('sub_cust_1_plan_pro');
      expect(sub.status).toBe('active');
    });
  });

  describe('FawryStrategy', () => {
    let strategy: FawryStrategy;

    beforeEach(() => {
      strategy = new FawryStrategy(mockConfigService as unknown as ConfigService);
    });

    it('should initiate mock payment when merchantCode is empty', async () => {
      const emptyConfig = { get: vi.fn().mockReturnValue('') };
      const emptyFawry = new FawryStrategy(emptyConfig as unknown as ConfigService);

      const res = await emptyFawry.initiatePayment({
        transactionId: 'tx_123',
        amount: 50,
        currency: PaymentCurrency.EGP,
        customer: { name: 'Omar', email: 'omar@example.com' },
      });

      expect(res.referenceNumber).toBeDefined();
      expect(res.status).toBe(PaymentStatus.PENDING);
    });

    it('should initiate payment with signature calculation and items', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ statusCode: 200, referenceNumber: '987654321' }),
      } as unknown as Response);

      const res = await strategy.initiatePayment({
        transactionId: 'tx_123',
        amount: 200,
        currency: PaymentCurrency.EGP,
        customer: { name: 'Omar', email: 'omar@example.com', phone: '01011111111' },
        items: [{ name: 'Service', quantity: 2, unitAmount: 100 }],
        returnUrl: 'https://app.com/return',
      });

      expect(res.referenceNumber).toBe('987654321');
      expect(res.checkoutUrl).toContain('987654321');
    });

    it('should throw error when Fawry charge returns non-200 statusCode', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ statusCode: 400, statusDescription: 'Invalid merchant reference' }),
      } as unknown as Response);

      await expect(
        strategy.initiatePayment({
          transactionId: 'tx_123',
          amount: 200,
          currency: PaymentCurrency.EGP,
          customer: { name: 'Omar', email: 'omar@example.com' },
        }),
      ).rejects.toThrow('Invalid merchant reference');
    });

    it('should verify Fawry payment status (paid and failed)', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ paymentStatus: 'PAID', paymentAmount: 200 }),
      } as unknown as Response);

      const resPaid = await strategy.verifyPayment('987654321');
      expect(resPaid.status).toBe(PaymentStatus.COMPLETED);
      expect(resPaid.amountPaid).toBe(200);

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ paymentStatus: 'UNPAID' }),
      } as unknown as Response);

      const resUnpaid = await strategy.verifyPayment('987654321');
      expect(resUnpaid.status).toBe(PaymentStatus.FAILED);
    });

    it('should return mock verify when merchant credentials not configured', async () => {
      const emptyConfig = { get: vi.fn().mockReturnValue('') };
      const emptyFawry = new FawryStrategy(emptyConfig as unknown as ConfigService);

      const res = await emptyFawry.verifyPayment('987654321');
      expect(res.status).toBe(PaymentStatus.COMPLETED);
      expect(res.amountPaid).toBe(100);
    });

    it('should handle Fawry verify error gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const res = await strategy.verifyPayment('987654321');
      expect(res.status).toBe(PaymentStatus.FAILED);
      expect(res.failureReason).toBe('Network offline');
    });

    it('should process Fawry refund successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ refundReferenceNumber: 'ref_rf_123' }),
      } as unknown as Response);

      const res = await strategy.refundPayment({ providerTransactionId: '987654321', amount: 50 });
      expect(res.status).toBe(PaymentStatus.REFUNDED);
      expect(res.refundId).toBe('ref_rf_123');
    });

    it('should return mock refund when merchant credentials not configured', async () => {
      const emptyConfig = { get: vi.fn().mockReturnValue('') };
      const emptyFawry = new FawryStrategy(emptyConfig as unknown as ConfigService);

      const res = await emptyFawry.refundPayment({ providerTransactionId: '987654321' });
      expect(res.status).toBe(PaymentStatus.REFUNDED);
      expect(res.refundId).toContain('fw_ref_');
    });

    it('should throw error when Fawry refund call throws', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Refund rejected'));

      await expect(
        strategy.refundPayment({ providerTransactionId: '987654321' }),
      ).rejects.toThrow('Refund rejected');
    });

    it('should parse Fawry webhook payload for PAID and FAILED status', async () => {
      const paidRes = await strategy.verifyAndParseWebhook(
        {},
        JSON.stringify({
          orderStatus: 'PAID',
          merchantRefNumber: 'tx_123',
          fawryRefNumber: '987654321',
        }),
      );
      expect(paidRes.isValid).toBe(true);
      expect(paidRes.status).toBe(PaymentStatus.COMPLETED);
      expect(paidRes.transactionId).toBe('tx_123');

      const failedRes = await strategy.verifyAndParseWebhook(
        {},
        {
          orderStatus: 'FAILED',
          merchantRefNumber: 'tx_failed',
          fawryRefNumber: '111',
        },
      );
      expect(failedRes.status).toBe(PaymentStatus.FAILED);
    });
  });

  describe('PaymobStrategy', () => {
    let strategy: PaymobStrategy;

    beforeEach(() => {
      strategy = new PaymobStrategy(mockConfigService as unknown as ConfigService);
    });

    it('should return mock checkout when apiKey is missing', async () => {
      const emptyConfig = { get: vi.fn().mockReturnValue('') };
      const emptyPaymob = new PaymobStrategy(emptyConfig as unknown as ConfigService);

      const res = await emptyPaymob.initiatePayment({
        transactionId: 'tx_123',
        amount: 100,
        currency: PaymentCurrency.EGP,
        customer: { name: 'Omar', email: 'omar@example.com' },
      });

      expect(res.providerTransactionId).toContain('paymob_');
      expect(res.status).toBe(PaymentStatus.PENDING);
    });

    it('should execute 3-step initiation flow', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'auth_tok' }) } as unknown as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'paymob_ord_1' }) } as unknown as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'payment_key_tok' }) } as unknown as Response);

      const res = await strategy.initiatePayment({
        transactionId: 'tx_123',
        amount: 300,
        currency: PaymentCurrency.EGP,
        customer: { name: 'Omar Sabry', email: 'omar@example.com' },
      });

      expect(res.providerTransactionId).toBe('paymob_ord_1');
      expect(res.checkoutUrl).toContain('payment_key_tok');
    });

    it('should throw error when initiation flow fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Paymob connection refused'));

      await expect(
        strategy.initiatePayment({
          transactionId: 'tx_123',
          amount: 300,
          currency: PaymentCurrency.EGP,
          customer: { name: 'Omar Sabry', email: 'omar@example.com' },
        }),
      ).rejects.toThrow('Paymob connection refused');
    });

    it('should verify Paymob transaction', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'auth_tok' }) } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, amount_cents: 30000, currency: 'EGP' }),
        } as unknown as Response);

      const res = await strategy.verifyPayment('paymob_ord_1');
      expect(res.status).toBe(PaymentStatus.COMPLETED);
      expect(res.amountPaid).toBe(300);
    });

    it('should return mock verify when apiKey is missing', async () => {
      const emptyConfig = { get: vi.fn().mockReturnValue('') };
      const emptyPaymob = new PaymobStrategy(emptyConfig as unknown as ConfigService);

      const res = await emptyPaymob.verifyPayment('paymob_ord_1');
      expect(res.status).toBe(PaymentStatus.COMPLETED);
      expect(res.currency).toBe('EGP');
    });

    it('should handle verify error and return FAILED', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Verify endpoint timeout'));

      const res = await strategy.verifyPayment('paymob_ord_1');
      expect(res.status).toBe(PaymentStatus.FAILED);
      expect(res.failureReason).toBe('Verify endpoint timeout');
    });

    it('should refund Paymob payment successfully', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'auth_tok' }) } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'pm_ref_555' }),
        } as unknown as Response);

      const res = await strategy.refundPayment({ providerTransactionId: '12345', amount: 50 });
      expect(res.status).toBe(PaymentStatus.REFUNDED);
      expect(res.refundId).toBe('pm_ref_555');
    });

    it('should return mock refund when apiKey is missing', async () => {
      const emptyConfig = { get: vi.fn().mockReturnValue('') };
      const emptyPaymob = new PaymobStrategy(emptyConfig as unknown as ConfigService);

      const res = await emptyPaymob.refundPayment({ providerTransactionId: '12345' });
      expect(res.status).toBe(PaymentStatus.REFUNDED);
      expect(res.refundId).toContain('pm_ref_');
    });

    it('should throw error when refund fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Paymob refund denied'));

      await expect(
        strategy.refundPayment({ providerTransactionId: '12345' }),
      ).rejects.toThrow('Paymob refund denied');
    });

    it('should parse Paymob webhook and validate HMAC', async () => {
      const payloadStr = JSON.stringify({
        obj: { id: 112233, success: true, order: { merchant_order_id: 'tx_123' } },
      });

      // Valid HMAC
      const crypto = await import('crypto');
      const validHmac = crypto.createHmac('sha512', 'paymob_hmac').update(payloadStr).digest('hex');

      const res = await strategy.verifyAndParseWebhook(
        { hmac: validHmac },
        payloadStr,
      );
      expect(res.isValid).toBe(true);
      expect(res.status).toBe(PaymentStatus.COMPLETED);
      expect(res.transactionId).toBe('tx_123');

      // Invalid HMAC
      const invalidRes = await strategy.verifyAndParseWebhook(
        { hmac: 'invalid_hmac' },
        payloadStr,
      );
      expect(invalidRes.isValid).toBe(false);

      const card = await strategy.saveCustomerPaymentMethod('u1', '12345678');
      expect(card.paymentMethodId).toBe('paymob_card_u1_123456');
    });
  });

  describe('PaypalStrategy', () => {
    let strategy: PaypalStrategy;

    beforeEach(() => {
      strategy = new PaypalStrategy(mockConfigService as unknown as ConfigService);
    });

    it('should fallback to mock initiation when credentials missing', async () => {
      const emptyConfig = { get: vi.fn().mockReturnValue('') };
      const emptyPaypal = new PaypalStrategy(emptyConfig as unknown as ConfigService);

      const res = await emptyPaypal.initiatePayment({
        transactionId: 'tx_123',
        amount: 50,
        currency: PaymentCurrency.USD,
        customer: { name: 'Omar', email: 'omar@example.com' },
      });

      expect(res.providerTransactionId).toContain('PAYPAL_');
      expect(res.status).toBe(PaymentStatus.PENDING);
    });

    it('should initiate PayPal checkout session', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'pp_access_tok' }) } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'PP_ORDER_1',
            links: [{ rel: 'approve', href: 'https://paypal.com/approve?token=123' }],
          }),
        } as unknown as Response);

      const res = await strategy.initiatePayment({
        transactionId: 'tx_123',
        amount: 75,
        currency: PaymentCurrency.USD,
        customer: { name: 'Omar', email: 'omar@example.com' },
      });

      expect(res.providerTransactionId).toBe('PP_ORDER_1');
      expect(res.checkoutUrl).toBe('https://paypal.com/approve?token=123');
    });

    it('should throw error when order creation fails', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'pp_access_tok' }) } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: 'Currency not supported' }),
        } as unknown as Response);

      await expect(
        strategy.initiatePayment({
          transactionId: 'tx_123',
          amount: 75,
          currency: PaymentCurrency.USD,
          customer: { name: 'Omar', email: 'omar@example.com' },
        }),
      ).rejects.toThrow('Currency not supported');
    });

    it('should verify PayPal order (completed and mock)', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'pp_access_tok' }) } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'PP_ORDER_1', status: 'COMPLETED' }),
        } as unknown as Response);

      const res = await strategy.verifyPayment('PP_ORDER_1');
      expect(res.status).toBe(PaymentStatus.COMPLETED);

      // Empty config mock verify
      const emptyConfig = { get: vi.fn().mockReturnValue('') };
      const emptyPaypal = new PaypalStrategy(emptyConfig as unknown as ConfigService);
      const mockRes = await emptyPaypal.verifyPayment('PP_ORDER_1');
      expect(mockRes.status).toBe(PaymentStatus.COMPLETED);
    });

    it('should handle verify error gracefully and return FAILED', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('PayPal API error'));

      const res = await strategy.verifyPayment('PP_ORDER_1');
      expect(res.status).toBe(PaymentStatus.FAILED);
      expect(res.failureReason).toBe('PayPal API error');
    });

    it('should refund PayPal payment successfully', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'pp_access_tok' }) } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'pp_refund_999' }),
        } as unknown as Response);

      const res = await strategy.refundPayment({
        providerTransactionId: 'capture_123',
        amount: 25,
        reason: 'Faulty item',
      });
      expect(res.status).toBe(PaymentStatus.REFUNDED);
      expect(res.refundId).toBe('pp_refund_999');
    });

    it('should return mock refund when PayPal credentials missing', async () => {
      const emptyConfig = { get: vi.fn().mockReturnValue('') };
      const emptyPaypal = new PaypalStrategy(emptyConfig as unknown as ConfigService);

      const res = await emptyPaypal.refundPayment({ providerTransactionId: 'cap_1' });
      expect(res.status).toBe(PaymentStatus.REFUNDED);
      expect(res.refundId).toContain('pp_ref_');
    });

    it('should throw error when PayPal refund fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Refund declined by PayPal'));

      await expect(
        strategy.refundPayment({ providerTransactionId: 'cap_1' }),
      ).rejects.toThrow('Refund declined by PayPal');
    });

    it('should parse PayPal webhook and support subscriptions', async () => {
      const res = await strategy.verifyAndParseWebhook(
        {},
        JSON.stringify({
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: { id: 'cap_1', custom_id: 'tx_123' },
        }),
      );
      expect(res.status).toBe(PaymentStatus.COMPLETED);
      expect(res.transactionId).toBe('tx_123');

      const failedRes = await strategy.verifyAndParseWebhook(
        {},
        {
          event_type: 'PAYMENT.CAPTURE.DENIED',
          resource: { id: 'cap_fail', custom_id: 'tx_fail' },
        },
      );
      expect(failedRes.status).toBe(PaymentStatus.FAILED);

      const sub = await strategy.createSubscription('u1', 'plan_1');
      expect(sub.subscriptionId).toBe('I-SUB-u1-plan_1');
      expect(sub.status).toBe('ACTIVE');
    });
  });
});
