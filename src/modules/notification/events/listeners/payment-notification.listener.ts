import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChannelType, NotificationCategory } from '@bts-soft/core';
import {
  PaymentCompletedEvent,
  PaymentFailedEvent,
  PaymentRefundedEvent,
} from '../../../payment/events/payment-domain.events.js';
import { NotificationService } from '../../notification.service.js';

@Injectable()
export class PaymentNotificationListener {
  private readonly logger = new Logger(PaymentNotificationListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent(PaymentCompletedEvent.EVENT_NAME)
  async handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    const { transaction } = event;
    this.logger.log(
      `Received PaymentCompletedEvent for transaction ${transaction.id} (user: ${transaction.userId})`,
    );

    if (!transaction.userId) return;

    try {
      await this.notificationService.sendNotification({
        channel: ChannelType.IN_APP,
        recipientId: transaction.userId,
        category: NotificationCategory.TRANSACTIONAL,
        subject: 'Payment Successful',
        body: `Your payment of ${transaction.amount} ${transaction.currency} was processed successfully (Ref: ${transaction.id}).`,
        context: {
          transactionId: transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          provider: transaction.provider,
          status: transaction.status,
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send payment completion notification for ${transaction.id}: ${msg}`,
      );
    }
  }

  @OnEvent(PaymentFailedEvent.EVENT_NAME)
  async handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
    const { transaction, reason } = event;
    this.logger.log(
      `Received PaymentFailedEvent for transaction ${transaction.id} (user: ${transaction.userId})`,
    );

    if (!transaction.userId) return;

    try {
      await this.notificationService.sendNotification({
        channel: ChannelType.IN_APP,
        recipientId: transaction.userId,
        category: NotificationCategory.TRANSACTIONAL,
        subject: 'Payment Failed',
        body: `Your payment of ${transaction.amount} ${transaction.currency} could not be completed.${reason ? ` Reason: ${reason}` : ''}`,
        context: {
          transactionId: transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          provider: transaction.provider,
          reason,
          status: transaction.status,
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send payment failure notification for ${transaction.id}: ${msg}`,
      );
    }
  }

  @OnEvent(PaymentRefundedEvent.EVENT_NAME)
  async handlePaymentRefunded(event: PaymentRefundedEvent): Promise<void> {
    const { transaction } = event;
    this.logger.log(
      `Received PaymentRefundedEvent for transaction ${transaction.id} (user: ${transaction.userId})`,
    );

    if (!transaction.userId) return;

    try {
      await this.notificationService.sendNotification({
        channel: ChannelType.IN_APP,
        recipientId: transaction.userId,
        category: NotificationCategory.TRANSACTIONAL,
        subject: 'Payment Refunded',
        body: `Your payment of ${transaction.amount} ${transaction.currency} has been refunded (Ref: ${transaction.id}).`,
        context: {
          transactionId: transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          provider: transaction.provider,
          status: transaction.status,
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send payment refund notification for ${transaction.id}: ${msg}`,
      );
    }
  }
}
