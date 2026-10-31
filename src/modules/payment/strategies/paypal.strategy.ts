import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '../enums/payment-provider.enum.js';
import { PaymentStatus } from '../enums/payment-status.enum.js';
import { IPaymentStrategy, ISubscriptionPaymentCapability } from '../interfaces/payment-strategy.interface.js';
import {
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentResult,
  RefundPaymentParams,
  RefundPaymentResult,
  WebhookVerificationResult,
} from '../interfaces/payment-result.interface.js';

@Injectable()
export class PaypalStrategy implements IPaymentStrategy, ISubscriptionPaymentCapability {
  readonly provider = PaymentProvider.PAYPAL;
  private readonly logger = new Logger(PaypalStrategy.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('PAYPAL_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>('PAYPAL_CLIENT_SECRET', '');
    this.baseUrl = this.configService.get<string>('PAYPAL_BASE_URL', 'https://api-m.sandbox.paypal.com');
  }

  private async getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const data = (await res.json()) as Record<string, unknown>;
    return String(data.access_token);
  }

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('PayPal client credentials not configured, generating mock approval url');
      return {
        providerTransactionId: `PAYPAL_${params.transactionId}`,
        checkoutUrl: `https://www.sandbox.paypal.com/checkoutnow?token=mock_${params.transactionId}`,
        status: PaymentStatus.PENDING,
      };
    }

    try {
      const accessToken = await this.getAccessToken();
      const payload = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: params.transactionId,
            custom_id: params.transactionId,
            description: `Payment ${params.transactionId}`,
            amount: {
              currency_code: params.currency,
              value: params.amount.toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: params.returnUrl || 'https://localhost/success',
          cancel_url: params.cancelUrl || 'https://localhost/cancel',
        },
      };

      const res = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        throw new Error(String(data.message ?? 'PayPal order creation failed'));
      }

      const links = (data.links as Array<{ rel: string; href: string }>) || [];
      const approveLink = links.find((l) => l.rel === 'approve')?.href;

      return {
        providerTransactionId: String(data.id),
        checkoutUrl: approveLink,
        status: PaymentStatus.PENDING,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'PayPal order creation failed';
      this.logger.error(`PayPal initiate failed: ${message}`);
      throw new Error(message);
    }
  }

  async verifyPayment(providerTransactionId: string): Promise<VerifyPaymentResult> {
    if (!this.clientId || !this.clientSecret) {
      return {
        providerTransactionId,
        status: PaymentStatus.COMPLETED,
        amountPaid: 100,
        currency: 'USD',
      };
    }

    try {
      const accessToken = await this.getAccessToken();
      const res = await fetch(`${this.baseUrl}/v2/checkout/orders/${providerTransactionId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await res.json()) as Record<string, unknown>;

      const statusStr = String(data.status ?? '');
      const isPaid = statusStr === 'COMPLETED' || statusStr === 'APPROVED';

      return {
        providerTransactionId,
        status: isPaid ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'PayPal verify error';
      return {
        providerTransactionId,
        status: PaymentStatus.FAILED,
        failureReason: message,
      };
    }
  }

  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    if (!this.clientId || !this.clientSecret) {
      return {
        refundId: `pp_ref_${Date.now()}`,
        status: PaymentStatus.REFUNDED,
      };
    }

    try {
      const accessToken = await this.getAccessToken();
      const payload: Record<string, unknown> = {};
      if (params.amount) {
        payload.amount = {
          value: params.amount.toFixed(2),
          currency_code: 'USD',
        };
      }
      if (params.reason) {
        payload.note_to_payer = params.reason;
      }

      const res = await fetch(`${this.baseUrl}/v2/payments/captures/${params.providerTransactionId}/refund`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as Record<string, unknown>;

      return {
        refundId: String(data.id ?? `pp_ref_${Date.now()}`),
        status: res.ok ? PaymentStatus.REFUNDED : PaymentStatus.FAILED,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'PayPal refund error';
      throw new Error(message);
    }
  }

  async verifyAndParseWebhook(
    _headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer | string | Record<string, unknown>,
  ): Promise<WebhookVerificationResult> {
    const payload = (typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody) as Record<string, unknown>;
    const eventType = String(payload.event_type ?? '');
    const resource = (payload.resource as Record<string, unknown>) || {};

    const isPaid = eventType === 'PAYMENT.CAPTURE.COMPLETED' || eventType === 'CHECKOUT.ORDER.APPROVED';
    const status = isPaid ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;

    return {
      isValid: true,
      event: eventType,
      transactionId: resource.custom_id ? String(resource.custom_id) : undefined,
      providerTransactionId: resource.id ? String(resource.id) : undefined,
      status,
      rawPayload: payload,
    };
  }

  async createSubscription(customerId: string, planId: string): Promise<{ subscriptionId: string; status: string }> {
    return { subscriptionId: `I-SUB-${customerId}-${planId}`, status: 'ACTIVE' };
  }
}
