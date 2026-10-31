import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PaymentProvider } from '../enums/payment-provider.enum.js';
import { PaymentStatus } from '../enums/payment-status.enum.js';
import { IPaymentStrategy, ICustomerVaultCapability } from '../interfaces/payment-strategy.interface.js';
import {
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentResult,
  RefundPaymentParams,
  RefundPaymentResult,
  WebhookVerificationResult,
} from '../interfaces/payment-result.interface.js';

@Injectable()
export class PaymobStrategy implements IPaymentStrategy, ICustomerVaultCapability {
  readonly provider = PaymentProvider.PAYMOB;
  private readonly logger = new Logger(PaymobStrategy.name);
  private readonly apiKey: string;
  private readonly hmacSecret: string;
  private readonly integrationId: string;
  private readonly iframeId: string;
  private readonly baseUrl = 'https://accept.paymob.com/api';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('PAYMOB_API_KEY', '');
    this.hmacSecret = this.configService.get<string>('PAYMOB_HMAC_SECRET', '');
    this.integrationId = this.configService.get<string>('PAYMOB_INTEGRATION_ID', '');
    this.iframeId = this.configService.get<string>('PAYMOB_IFRAME_ID', '12345');
  }

  private async authenticate(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/auth/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: this.apiKey }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    return String(data.token);
  }

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    if (!this.apiKey || !this.integrationId) {
      this.logger.warn('Paymob api key or integration id not configured, generating mock checkout');
      return {
        providerTransactionId: `paymob_${params.transactionId}`,
        checkoutUrl: `${this.baseUrl}/acceptance/iframes/${this.iframeId}?payment_token=mock_token`,
        status: PaymentStatus.PENDING,
      };
    }

    try {
      // Step 1: Authentication token
      const authToken = await this.authenticate();

      // Step 2: Order Registration
      const orderRes = await fetch(`${this.baseUrl}/ecommerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_token: authToken,
          delivery_needed: 'false',
          amount_cents: Math.round(params.amount * 100).toString(),
          currency: params.currency,
          merchant_order_id: params.transactionId,
          items: [],
        }),
      });
      const orderData = (await orderRes.json()) as Record<string, unknown>;
      const paymobOrderId = String(orderData.id);

      // Step 3: Payment Key Request
      const nameParts = params.customer.name.split(' ');
      const firstName = nameParts[0] || 'Customer';
      const lastName = nameParts.slice(1).join(' ') || 'User';

      const keyRes = await fetch(`${this.baseUrl}/acceptance/payment_keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_token: authToken,
          amount_cents: Math.round(params.amount * 100).toString(),
          expiration: 3600,
          order_id: paymobOrderId,
          billing_data: {
            apartment: 'NA',
            email: params.customer.email,
            floor: 'NA',
            first_name: firstName,
            street: 'NA',
            building: 'NA',
            phone_number: params.customer.phone || '01000000000',
            shipping_method: 'PKG',
            postal_code: 'NA',
            city: 'Cairo',
            country: 'EG',
            last_name: lastName,
            state: 'Cairo',
          },
          currency: params.currency,
          integration_id: Number(this.integrationId),
        }),
      });
      const keyData = (await keyRes.json()) as Record<string, unknown>;
      const paymentToken = String(keyData.token);

      return {
        providerTransactionId: paymobOrderId,
        checkoutUrl: `https://accept.paymob.com/api/acceptance/iframes/${this.iframeId}?payment_token=${paymentToken}`,
        status: PaymentStatus.PENDING,
        rawResponse: keyData,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Paymob initiate error';
      this.logger.error(`Paymob initiate error: ${message}`);
      throw new Error(message);
    }
  }

  async verifyPayment(providerTransactionId: string): Promise<VerifyPaymentResult> {
    if (!this.apiKey) {
      return {
        providerTransactionId,
        status: PaymentStatus.COMPLETED,
        amountPaid: 100,
        currency: 'EGP',
      };
    }

    try {
      const authToken = await this.authenticate();
      const res = await fetch(`${this.baseUrl}/acceptance/transactions/${providerTransactionId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = (await res.json()) as Record<string, unknown>;
      const isSuccess = data.success === true;

      return {
        providerTransactionId,
        status: isSuccess ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
        amountPaid: typeof data.amount_cents === 'number' ? data.amount_cents / 100 : undefined,
        currency: typeof data.currency === 'string' ? data.currency : 'EGP',
        rawResponse: data,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Paymob verify error';
      return {
        providerTransactionId,
        status: PaymentStatus.FAILED,
        failureReason: message,
      };
    }
  }

  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    if (!this.apiKey) {
      return {
        refundId: `pm_ref_${Date.now()}`,
        status: PaymentStatus.REFUNDED,
      };
    }

    try {
      const authToken = await this.authenticate();
      const res = await fetch(`${this.baseUrl}/acceptance/void_refund/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          auth_token: authToken,
          transaction_id: params.providerTransactionId,
          amount_cents: params.amount ? Math.round(params.amount * 100) : undefined,
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;

      return {
        refundId: String(data.id ?? `pm_ref_${Date.now()}`),
        status: res.ok ? PaymentStatus.REFUNDED : PaymentStatus.FAILED,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Paymob refund error';
      throw new Error(message);
    }
  }

  async verifyAndParseWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer | string | Record<string, unknown>,
  ): Promise<WebhookVerificationResult> {
    const payload = (typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody) as Record<string, unknown>;
    const obj = (payload.obj as Record<string, unknown>) || payload;
    const isSuccess = obj.success === true;
    const orderObj = obj.order as Record<string, unknown> | undefined;

    let isValid = true;
    const hmacHeader = (headers['hmac'] || headers['x-paymob-hmac']) as string | undefined;
    if (this.hmacSecret && hmacHeader && typeof rawBody === 'string') {
      const calculatedHmac = createHmac('sha512', this.hmacSecret).update(rawBody).digest('hex');
      isValid = calculatedHmac === hmacHeader;
    }

    return {
      isValid,
      event: isSuccess ? 'TRANSACTION_SUCCESS' : 'TRANSACTION_FAILED',
      transactionId: orderObj?.merchant_order_id ? String(orderObj.merchant_order_id) : undefined,
      providerTransactionId: obj.id ? String(obj.id) : undefined,
      status: isSuccess ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
      rawPayload: payload,
    };
  }

  async saveCustomerPaymentMethod(customerId: string, token: string): Promise<{ paymentMethodId: string }> {
    return { paymentMethodId: `paymob_card_${customerId}_${token.slice(0, 6)}` };
  }
}
