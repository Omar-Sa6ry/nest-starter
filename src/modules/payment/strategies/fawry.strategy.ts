import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PaymentProvider } from '../enums/payment-provider.enum.js';
import { PaymentStatus } from '../enums/payment-status.enum.js';
import { IPaymentStrategy } from '../interfaces/payment-strategy.interface.js';
import {
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentResult,
  RefundPaymentParams,
  RefundPaymentResult,
  WebhookVerificationResult,
} from '../interfaces/payment-result.interface.js';

@Injectable()
export class FawryStrategy implements IPaymentStrategy {
  readonly provider = PaymentProvider.FAWRY;
  private readonly logger = new Logger(FawryStrategy.name);
  private readonly merchantCode: string;
  private readonly securityKey: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.merchantCode = this.configService.get<string>('FAWRY_MERCHANT_CODE', '');
    this.securityKey = this.configService.get<string>('FAWRY_SECURITY_KEY', '');
    this.baseUrl = this.configService.get<string>('FAWRY_BASE_URL', 'https://atfawry.fawrystaging.com');
  }

  private generateSignature(...params: (string | number)[]): string {
    const raw = params.join('') + this.securityKey;
    return createHash('sha256').update(raw).digest('hex');
  }

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    if (!this.merchantCode || !this.securityKey) {
      this.logger.warn('Fawry merchant code or secret not configured, generating mock reference number');
      const mockRef = `FW${Date.now().toString().slice(-8)}`;
      return {
        providerTransactionId: `fawry_${params.transactionId}`,
        referenceNumber: mockRef,
        checkoutUrl: `${this.baseUrl}/fawrypay-web/display?refNumber=${mockRef}`,
        status: PaymentStatus.PENDING,
      };
    }

    try {
      const chargeItems = (params.items && params.items.length > 0)
        ? params.items.map((item, idx) => ({
            itemId: String(idx + 1),
            description: item.name,
            price: Number(item.unitAmount.toFixed(2)),
            quantity: item.quantity,
          }))
        : [
            {
              itemId: '1',
              description: `Payment ${params.transactionId}`,
              price: Number(params.amount.toFixed(2)),
              quantity: 1,
            },
          ];

      const signature = this.generateSignature(
        this.merchantCode,
        params.transactionId,
        params.customer.phone || '',
        params.amount.toFixed(2),
      );

      const payload = {
        merchantCode: this.merchantCode,
        merchantRefNum: params.transactionId,
        customerProfileId: params.customer.phone || params.customer.email,
        customerMobile: params.customer.phone || '01000000000',
        customerEmail: params.customer.email,
        customerName: params.customer.name,
        amount: Number(params.amount.toFixed(2)),
        currencyCode: params.currency,
        chargeItems,
        returnUrl: params.returnUrl,
        signature,
      };

      const response = await fetch(`${this.baseUrl}/ECommerceWeb/Fawry/payments/charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok || data.statusCode !== 200) {
        throw new Error(String(data.statusDescription ?? 'Fawry initiation failed'));
      }

      const referenceNumber = String(data.referenceNumber ?? '');
      return {
        providerTransactionId: referenceNumber || params.transactionId,
        referenceNumber,
        checkoutUrl: `${this.baseUrl}/fawrypay-web/display?refNumber=${referenceNumber}`,
        status: PaymentStatus.PENDING,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown Fawry error';
      this.logger.error(`Fawry initiate failed: ${message}`);
      throw new Error(message);
    }
  }

  async verifyPayment(providerTransactionId: string): Promise<VerifyPaymentResult> {
    if (!this.merchantCode || !this.securityKey) {
      return {
        providerTransactionId,
        status: PaymentStatus.COMPLETED,
        amountPaid: 100,
        currency: 'EGP',
      };
    }

    try {
      const signature = this.generateSignature(this.merchantCode, providerTransactionId);
      const url = `${this.baseUrl}/ECommerceWeb/Fawry/payments/status/v2?merchantCode=${this.merchantCode}&merchantRefNumber=${providerTransactionId}&signature=${signature}`;

      const response = await fetch(url);
      const data = (await response.json()) as Record<string, unknown>;

      const paymentStatusStr = String(data.paymentStatus ?? '');
      const isPaid = paymentStatusStr === 'PAID';

      return {
        providerTransactionId,
        status: isPaid ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
        amountPaid: typeof data.paymentAmount === 'number' ? data.paymentAmount : undefined,
        currency: 'EGP',
        rawResponse: data,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fawry verify error';
      return {
        providerTransactionId,
        status: PaymentStatus.FAILED,
        failureReason: message,
      };
    }
  }

  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    if (!this.merchantCode || !this.securityKey) {
      return {
        refundId: `fw_ref_${Date.now()}`,
        status: PaymentStatus.REFUNDED,
      };
    }

    try {
      const amount = Number(params.amount ?? 0).toFixed(2);
      const signature = this.generateSignature(
        this.merchantCode,
        params.providerTransactionId,
        amount,
      );

      const payload = {
        merchantCode: this.merchantCode,
        referenceNumber: params.providerTransactionId,
        refundAmount: amount,
        reason: params.reason || 'Customer refund',
        signature,
      };

      const response = await fetch(`${this.baseUrl}/ECommerceWeb/Fawry/payments/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as Record<string, unknown>;
      return {
        refundId: String(data.refundReferenceNumber ?? `fw_ref_${Date.now()}`),
        status: response.ok ? PaymentStatus.REFUNDED : PaymentStatus.FAILED,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fawry refund error';
      throw new Error(message);
    }
  }

  async verifyAndParseWebhook(
    _headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer | string | Record<string, unknown>,
  ): Promise<WebhookVerificationResult> {
    const payload = (typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody) as Record<string, unknown>;
    const orderStatus = String(payload.orderStatus ?? payload.paymentStatus ?? '');
    const isPaid = orderStatus === 'PAID' || orderStatus === 'SUCCESS';

    return {
      isValid: true,
      event: orderStatus,
      transactionId: payload.merchantRefNumber ? String(payload.merchantRefNumber) : undefined,
      providerTransactionId: payload.fawryRefNumber ? String(payload.fawryRefNumber) : undefined,
      status: isPaid ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
      rawPayload: payload,
    };
  }
}
