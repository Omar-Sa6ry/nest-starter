import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentWebhookController } from './payment.controller.js';
import { PaymentProvider } from './enums/payment-provider.enum.js';
import { PaymentStatus } from './enums/payment-status.enum.js';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import type { PaymentService } from './payment.service.js';

describe('PaymentWebhookController', () => {
  let controller: PaymentWebhookController;
  let mockPaymentService: {
    handleWebhook: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPaymentService = {
      handleWebhook: vi.fn().mockResolvedValue({
        processed: true,
        transactionId: 'tx_123',
        status: PaymentStatus.COMPLETED,
      }),
    };
    controller = new PaymentWebhookController(mockPaymentService as unknown as PaymentService);
  });

  it('should process webhook for supported provider', async () => {
    const mockReq = { body: { type: 'checkout.session.completed' } } as unknown as Request;
    const res = await controller.handleWebhook(
      'stripe',
      { 'stripe-signature': 'sig_123' },
      mockReq,
    );

    expect(res.success).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.message).toBe('Webhook processed successfully');
    expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(
      PaymentProvider.STRIPE,
      expect.anything(),
      expect.anything(),
    );
  });

  it('should throw BadRequestException for unsupported provider', async () => {
    const mockReq = {} as unknown as Request;
    await expect(
      controller.handleWebhook('unknown_gateway', {}, mockReq),
    ).rejects.toThrow(BadRequestException);
  });
});

