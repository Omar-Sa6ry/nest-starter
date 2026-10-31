import { registerEnumType } from '@nestjs/graphql';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

registerEnumType(PaymentStatus, {
  name: 'PaymentStatus',
  description: 'Lifecycle statuses for a payment transaction',
});
