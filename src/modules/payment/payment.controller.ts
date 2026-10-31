import {
  Controller,
  Post,
  Param,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentService } from './payment.service.js';
import { PaymentProvider } from './enums/payment-provider.enum.js';

@Controller('webhooks/payment')
export class PaymentWebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('provider') providerParam: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request,
  ): Promise<{ success: boolean; statusCode: number; message: string; timeStamp: string }> {
    const providerUpper = providerParam.toUpperCase();
    const provider = Object.values(PaymentProvider).find((p) => p === providerUpper);

    if (!provider) {
      throw new BadRequestException(`Unsupported payment provider '${providerParam}'`);
    }

    const payload = (req.body as Record<string, unknown>) || {};
    await this.paymentService.handleWebhook(provider, headers, payload);

    return {
      success: true,
      statusCode: 200,
      message: 'Webhook processed successfully',
      timeStamp: new Date().toISOString(),
    };
  }
}
