import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentTransaction } from './entity/payment-transaction.entity.js';
import { PaymentService } from './payment.service.js';
import { PaymentResolver } from './payment.resolver.js';
import { PaymentWebhookController } from './payment.controller.js';
import { PaymentStrategyFactory } from './strategies/payment-strategy.factory.js';
import { StripeStrategy } from './strategies/stripe.strategy.js';
import { FawryStrategy } from './strategies/fawry.strategy.js';
import { PaymobStrategy } from './strategies/paymob.strategy.js';
import { PaypalStrategy } from './strategies/paypal.strategy.js';
import { MetricsModule } from '../../common/metrics/metrics.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentTransaction]),
    MetricsModule,
  ],
  controllers: [PaymentWebhookController],
  providers: [
    PaymentService,
    PaymentResolver,
    PaymentStrategyFactory,
    StripeStrategy,
    FawryStrategy,
    PaymobStrategy,
    PaypalStrategy,
  ],
  exports: [PaymentService, PaymentStrategyFactory],
})
export class PaymentModule {}
