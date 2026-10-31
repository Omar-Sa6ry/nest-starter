import { PaymentStatus } from '../enums/payment-status.enum.js';
import { PaymentCurrency } from '../enums/payment-currency.enum.js';

export interface PaymentCustomerInfo {
  name: string;
  email: string;
  phone?: string;
}

export interface PaymentItemInfo {
  name: string;
  quantity: number;
  unitAmount: number;
  description?: string;
}

export interface InitiatePaymentParams {
  transactionId: string;
  amount: number;
  currency: PaymentCurrency;
  customer: PaymentCustomerInfo;
  items?: PaymentItemInfo[];
  returnUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface InitiatePaymentResult {
  providerTransactionId: string;
  checkoutUrl?: string;
  referenceNumber?: string;
  rawResponse?: Record<string, unknown>;
  status: PaymentStatus;
}

export interface VerifyPaymentResult {
  providerTransactionId: string;
  status: PaymentStatus;
  amountPaid?: number;
  currency?: string;
  rawResponse?: Record<string, unknown>;
  failureReason?: string;
}

export interface RefundPaymentParams {
  providerTransactionId: string;
  amount?: number;
  reason?: string;
}

export interface RefundPaymentResult {
  refundId: string;
  status: PaymentStatus;
  rawResponse?: Record<string, unknown>;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  event: string;
  transactionId?: string;
  providerTransactionId?: string;
  status: PaymentStatus;
  rawPayload: Record<string, unknown>;
  failureReason?: string;
}
