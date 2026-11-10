import { PaymentStatus } from '../enums/payment-status.enum.js';
import { PaymentCurrency } from '../enums/payment-currency.enum.js';

export interface IPaymentCustomerInfo {
  name: string;
  email: string;
  phone?: string;
}

export interface IPaymentItemInfo {
  name: string;
  quantity: number;
  unitAmount: number;
  description?: string;
}

export interface IInitiatePaymentParams {
  transactionId: string;
  amount: number;
  currency: PaymentCurrency;
  customer: IPaymentCustomerInfo;
  items?: IPaymentItemInfo[];
  returnUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface IInitiatePaymentResult {
  providerTransactionId: string;
  checkoutUrl?: string;
  referenceNumber?: string;
  rawResponse?: Record<string, unknown>;
  status: PaymentStatus;
}

export interface IVerifyPaymentResult {
  providerTransactionId: string;
  status: PaymentStatus;
  amountPaid?: number;
  currency?: string;
  rawResponse?: Record<string, unknown>;
  failureReason?: string;
}

export interface IRefundPaymentParams {
  providerTransactionId: string;
  amount?: number;
  reason?: string;
}

export interface IRefundPaymentResult {
  refundId: string;
  status: PaymentStatus;
  rawResponse?: Record<string, unknown>;
}

export interface IWebhookVerificationResult {
  isValid: boolean;
  event: string;
  transactionId?: string;
  providerTransactionId?: string;
  status: PaymentStatus;
  rawPayload: Record<string, unknown>;
  failureReason?: string;
}

// Backward-compatible type aliases
export type PaymentCustomerInfo = IPaymentCustomerInfo;
export type PaymentItemInfo = IPaymentItemInfo;
export type InitiatePaymentParams = IInitiatePaymentParams;
export type InitiatePaymentResult = IInitiatePaymentResult;
export type VerifyPaymentResult = IVerifyPaymentResult;
export type RefundPaymentParams = IRefundPaymentParams;
export type RefundPaymentResult = IRefundPaymentResult;
export type WebhookVerificationResult = IWebhookVerificationResult;

