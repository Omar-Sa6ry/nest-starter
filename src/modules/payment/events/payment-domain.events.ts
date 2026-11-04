import { PaymentTransaction } from '../entity/payment-transaction.entity.js';

export class PaymentCompletedEvent {
  static readonly EVENT_NAME = 'payment.completed';

  constructor(public readonly transaction: PaymentTransaction) {}
}

export class PaymentFailedEvent {
  static readonly EVENT_NAME = 'payment.failed';

  constructor(
    public readonly transaction: PaymentTransaction,
    public readonly reason?: string,
  ) {}
}

export class PaymentRefundedEvent {
  static readonly EVENT_NAME = 'payment.refunded';

  constructor(public readonly transaction: PaymentTransaction) {}
}

