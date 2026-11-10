import { PaymentProvider } from '../enums/payment-provider.enum.js';
import {
  IInitiatePaymentParams,
  IInitiatePaymentResult,
  IVerifyPaymentResult,
  IRefundPaymentParams,
  IRefundPaymentResult,
  IWebhookVerificationResult,
} from './IPayment-result.interface.js';

export interface IPaymentStrategy {
  readonly provider: PaymentProvider;

  initiatePayment(params: IInitiatePaymentParams): Promise<IInitiatePaymentResult>;

  verifyPayment(providerTransactionId: string): Promise<IVerifyPaymentResult>;

  refundPayment(params: IRefundPaymentParams): Promise<IRefundPaymentResult>;

  verifyAndParseWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer | string | Record<string, unknown>,
  ): Promise<IWebhookVerificationResult>;
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

