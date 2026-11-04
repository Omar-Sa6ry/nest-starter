import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentNotificationListener } from './payment-notification.listener.js';
import { NotificationService } from '../../notification.service.js';
import {
  PaymentCompletedEvent,
  PaymentFailedEvent,
  PaymentRefundedEvent,
} from '../../../payment/events/payment-domain.events.js';
import { PaymentTransaction } from '../../../payment/entity/payment-transaction.entity.js';
import { PaymentStatus } from '../../../payment/enums/payment-status.enum.js';
import { PaymentProvider } from '../../../payment/enums/payment-provider.enum.js';
import { PaymentCurrency } from '../../../payment/enums/payment-currency.enum.js';
import { ChannelType, NotificationCategory } from '@bts-soft/core';

describe('PaymentNotificationListener', () => {
  let listener: PaymentNotificationListener;
  let notificationService: {
    sendNotification: ReturnType<typeof vi.fn>;
    sendEmail: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    notificationService = {
      sendNotification: vi.fn().mockResolvedValue({} as never),
      sendEmail: vi.fn().mockResolvedValue({} as never),
    };

    listener = new PaymentNotificationListener(
      notificationService as unknown as NotificationService,
    );
  });

  const baseTx = {
    id: 'tx-123',
    userId: 'user-456',
    amount: 100,
    currency: PaymentCurrency.USD,
    provider: PaymentProvider.STRIPE,
    status: PaymentStatus.COMPLETED,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as PaymentTransaction;

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  it('should handle PaymentCompletedEvent by sending notification', async () => {
    const event = new PaymentCompletedEvent(baseTx);
    await listener.handlePaymentCompleted(event);

    expect(notificationService.sendNotification).toHaveBeenCalledWith({
      channel: ChannelType.IN_APP,
      recipientId: 'user-456',
      category: NotificationCategory.TRANSACTIONAL,
      subject: 'Payment Successful',
      body: expect.stringContaining('100 USD'),
      context: expect.objectContaining({
        transactionId: 'tx-123',
        status: PaymentStatus.COMPLETED,
      }),
    });
  });

  it('should handle PaymentFailedEvent by sending notification', async () => {
    const failedTx = {
      ...baseTx,
      status: PaymentStatus.FAILED,
      failureReason: 'Insufficient funds',
    } as unknown as PaymentTransaction;
    const event = new PaymentFailedEvent(failedTx, 'Insufficient funds');
    await listener.handlePaymentFailed(event);

    expect(notificationService.sendNotification).toHaveBeenCalledWith({
      channel: ChannelType.IN_APP,
      recipientId: 'user-456',
      category: NotificationCategory.TRANSACTIONAL,
      subject: 'Payment Failed',
      body: expect.stringContaining('Insufficient funds'),
      context: expect.objectContaining({
        transactionId: 'tx-123',
        status: PaymentStatus.FAILED,
        reason: 'Insufficient funds',
      }),
    });
  });

  it('should handle PaymentRefundedEvent by sending notification', async () => {
    const refundedTx = {
      ...baseTx,
      status: PaymentStatus.REFUNDED,
    } as unknown as PaymentTransaction;
    const event = new PaymentRefundedEvent(refundedTx);
    await listener.handlePaymentRefunded(event);

    expect(notificationService.sendNotification).toHaveBeenCalledWith({
      channel: ChannelType.IN_APP,
      recipientId: 'user-456',
      category: NotificationCategory.TRANSACTIONAL,
      subject: 'Payment Refunded',
      body: expect.stringContaining('100 USD'),
      context: expect.objectContaining({
        transactionId: 'tx-123',
        status: PaymentStatus.REFUNDED,
      }),
    });
  });
});
