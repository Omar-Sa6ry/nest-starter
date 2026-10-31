import { registerEnumType } from '@nestjs/graphql';

export enum PaymentProvider {
  STRIPE = 'STRIPE',
  FAWRY = 'FAWRY',
  PAYMOB = 'PAYMOB',
  PAYPAL = 'PAYPAL',
}

registerEnumType(PaymentProvider, {
  name: 'PaymentProvider',
  description: 'Supported payment gateway providers',
});
