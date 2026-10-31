import { registerEnumType } from '@nestjs/graphql';

export enum PaymentCurrency {
  USD = 'USD',
  EUR = 'EUR',
  EGP = 'EGP',
  SAR = 'SAR',
  AED = 'AED',
}

registerEnumType(PaymentCurrency, {
  name: 'PaymentCurrency',
  description: 'Supported currencies for payment operations',
});
