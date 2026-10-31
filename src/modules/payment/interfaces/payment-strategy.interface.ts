import { PaymentProvider } from '../enums/payment-provider.enum.js';
import {
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentResult,
  RefundPaymentParams,
  RefundPaymentResult,
  WebhookVerificationResult,
} from './payment-result.interface.js';

export interface IPaymentStrategy {
  readonly provider: PaymentProvider;

  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;

  verifyPayment(providerTransactionId: string): Promise<VerifyPaymentResult>;

  refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult>;

  verifyAndParseWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer | string | Record<string, unknown>,
  ): Promise<WebhookVerificationResult>;
}

// Capability interface for providers supporting Customer Vault / Tokenization (e.g. Stripe, Paymob)
export interface ICustomerVaultCapability {
  saveCustomerPaymentMethod(
    customerId: string,
    token: string,
  ): Promise<{ paymentMethodId: string }>;
}

// Capability interface for providers supporting Recurring Subscriptions
export interface ISubscriptionPaymentCapability {
  createSubscription(
    customerId: string,
    planId: string,
  ): Promise<{ subscriptionId: string; status: string }>;
}
