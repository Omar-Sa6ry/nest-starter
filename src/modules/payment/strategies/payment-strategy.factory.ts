import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentProvider } from '../enums/payment-provider.enum.js';
import { IPaymentStrategy } from '../interfaces/payment-strategy.interface.js';
import { StripeStrategy } from './stripe.strategy.js';
import { FawryStrategy } from './fawry.strategy.js';
import { PaymobStrategy } from './paymob.strategy.js';
import { PaypalStrategy } from './paypal.strategy.js';

@Injectable()
export class PaymentStrategyFactory {
  private readonly strategies: Map<PaymentProvider, IPaymentStrategy> = new Map();

  constructor(
    private readonly stripeStrategy: StripeStrategy,
    private readonly fawryStrategy: FawryStrategy,
    private readonly paymobStrategy: PaymobStrategy,
    private readonly paypalStrategy: PaypalStrategy,
  ) {
    this.strategies.set(PaymentProvider.STRIPE, this.stripeStrategy);
    this.strategies.set(PaymentProvider.FAWRY, this.fawryStrategy);
    this.strategies.set(PaymentProvider.PAYMOB, this.paymobStrategy);
    this.strategies.set(PaymentProvider.PAYPAL, this.paypalStrategy);
  }

  getStrategy(provider: PaymentProvider): IPaymentStrategy {
    const strategy = this.strategies.get(provider);
    if (!strategy) {
      throw new BadRequestException(`Payment provider '${provider}' is not supported`);
    }
    return strategy;
  }

  registerStrategy(provider: PaymentProvider, strategy: IPaymentStrategy): void {
    this.strategies.set(provider, strategy);
  }

  getSupportedProviders(): PaymentProvider[] {
    return Array.from(this.strategies.keys());
  }
}
