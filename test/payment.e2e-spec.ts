import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { RoleGuard } from '../src/common/guard/role.guard.js';
import { Role, Permission } from '../src/common/constant/enum.constant.js';
import { PaymentProvider } from '../src/modules/payment/enums/payment-provider.enum.js';
import { PaymentStatus } from '../src/modules/payment/enums/payment-status.enum.js';
import { PaymentCurrency } from '../src/modules/payment/enums/payment-currency.enum.js';
import { StripeStrategy } from '../src/modules/payment/strategies/stripe.strategy.js';
import { ApiAliasMiddleware } from '../src/common/middleware/api-alias.middleware.js';
import type { IAuthenticatedRequest, IAuthenticatedUser } from '../src/common/interfaces/IContext.interface.js';

describe('Payment (e2e)', { timeout: 60_000 }, () => {
  let app: INestApplication;

  const mockAdminUser: IAuthenticatedUser = {
    id: 'admin-e2e-id',
    email: 'admin@example.com',
    role: Role.ADMIN,
    permissions: [
      Permission.PAYMENT_INITIATE,
      Permission.PAYMENT_VIEW,
      Permission.PAYMENT_MANAGE,
    ],
  };

  const mockNormalUser: IAuthenticatedUser = {
    id: 'user-e2e-1',
    email: 'user1@example.com',
    role: Role.USER,
    permissions: [Permission.PAYMENT_INITIATE, Permission.PAYMENT_VIEW],
  };

  let currentUserContext: IAuthenticatedUser = mockAdminUser;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(RoleGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req =
            (context.getType<string>() === 'graphql'
              ? context.getArgs()[2].req
              : context.switchToHttp().getRequest()) as IAuthenticatedRequest;

          req.user = currentUserContext;
          return true;
        },
      })
      .overrideProvider(StripeStrategy)
      .useValue({
        provider: PaymentProvider.STRIPE,
        initiatePayment: async (params: any) => ({
          providerTransactionId: `cs_e2e_${params.transactionId}`,
          checkoutUrl: `https://checkout.stripe.com/pay/cs_e2e_${params.transactionId}`,
          status: PaymentStatus.PENDING,
        }),
        verifyPayment: async (providerTransactionId: string) => ({
          providerTransactionId,
          status: PaymentStatus.COMPLETED,
          amountPaid: 150.0,
          currency: 'USD',
        }),
        refundPayment: async (params: any) => ({
          refundId: `re_e2e_${Date.now()}`,
          status: PaymentStatus.REFUNDED,
        }),
        verifyAndParseWebhook: async (_headers: any, rawBody: any) => {
          const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
          return {
            isValid: true,
            event: payload.type || 'checkout.session.completed',
            transactionId: payload?.data?.object?.client_reference_id,
            providerTransactionId: payload?.data?.object?.id,
            status: PaymentStatus.COMPLETED,
            rawPayload: payload,
          };
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(
      (req: any, res: any, next: any) =>
        new ApiAliasMiddleware().use(req, res, next),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GraphQL Payment Mutations & Queries', () => {
    let createdTransactionId: string;

    it('initiates payment successfully via GraphQL mutation', async () => {
      currentUserContext = mockNormalUser;
      const mutation = `
        mutation InitiatePayment($input: InitiatePaymentInput!) {
          initiatePayment(input: $input) {
            success
            statusCode
            message
            data {
              transactionId
              status
              providerTransactionId
              checkoutUrl
            }
          }
        }
      `;

      const variables = {
        input: {
          amount: 150.0,
          currency: PaymentCurrency.USD,
          provider: PaymentProvider.STRIPE,
          customer: {
            name: 'Omar Sabry',
            email: 'omar@example.com',
            phone: '+201000000000',
          },
          items: [
            {
              name: 'Pro License',
              quantity: 1,
              unitAmount: 150.0,
            },
          ],
        },
      };

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query: mutation, variables });

      expect(res.status).toBe(200);
      const data = res.body?.data?.initiatePayment;
      expect(data?.success).toBe(true);
      expect(data?.data?.transactionId).toBeDefined();
      expect(data?.data?.status).toBe(PaymentStatus.PENDING);
      createdTransactionId = data?.data?.transactionId;
    });

    it('retrieves transaction by ID via getPaymentTransaction query', async () => {
      currentUserContext = mockNormalUser;
      const query = `
        query GetPaymentTransaction($id: String!) {
          getPaymentTransaction(id: $id) {
            success
            statusCode
            data {
              id
              userId
              amount
              status
              provider
            }
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query, variables: { id: createdTransactionId } });

      expect(res.status).toBe(200);
      const data = res.body?.data?.getPaymentTransaction;
      expect(data?.success).toBe(true);
      expect(data?.data?.id).toBe(createdTransactionId);
      expect(data?.data?.amount).toBe(150.0);
    });

    it('retrieves paginated transactions via getPaymentTransactions query', async () => {
      currentUserContext = mockNormalUser;
      const query = `
        query GetPaymentTransactions($page: Int!, $limit: Int!) {
          getPaymentTransactions(page: $page, limit: $limit) {
            success
            statusCode
            data {
              paginationInfo {
                totalItems
                currentPage
              }
              items {
                id
                amount
                status
              }
            }
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query, variables: { page: 1, limit: 10 } });

      expect(res.status).toBe(200);
      const data = res.body?.data?.getPaymentTransactions;
      expect(data?.success).toBe(true);
      expect(data?.data?.items?.length).toBeGreaterThan(0);
    });

    it('verifies payment status via verifyPayment mutation', async () => {
      currentUserContext = mockNormalUser;
      const mutation = `
        mutation VerifyPayment($transactionId: String!) {
          verifyPayment(transactionId: $transactionId) {
            success
            statusCode
            data {
              id
              status
            }
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query: mutation, variables: { transactionId: createdTransactionId } });

      expect(res.status).toBe(200);
      const data = res.body?.data?.verifyPayment;
      expect(data?.success).toBe(true);
      expect(data?.data?.id).toBe(createdTransactionId);
      expect(data?.data?.status).toBe(PaymentStatus.COMPLETED);
    });

    it('refunds completed payment via refundPayment mutation (requires admin)', async () => {
      currentUserContext = mockAdminUser;
      const mutation = `
        mutation RefundPayment($input: RefundPaymentInput!) {
          refundPayment(input: $input) {
            success
            statusCode
            data {
              id
              status
            }
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: mutation,
          variables: {
            input: {
              transactionId: createdTransactionId,
              amount: 50.0,
              reason: 'Customer request',
            },
          },
        });

      expect(res.status).toBe(200);
      const data = res.body?.data?.refundPayment;
      expect(data?.success).toBe(true);
      expect(data?.data?.status).toBe(PaymentStatus.REFUNDED);
    });
  });

  describe('REST Webhooks Endpoints', () => {
    it('processes Stripe webhook callback via HTTP POST', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks/payment/stripe')
        .set('stripe-signature', 'mock-signature')
        .send({
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_mock_123',
              client_reference_id: 'tx_e2e_123',
            },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(res.body?.message).toBe('Webhook processed successfully');
    });

    it('rejects unsupported provider webhook with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks/payment/unsupported_gateway')
        .send({});

      expect(res.status).toBe(400);
    });

    it('processes Fawry webhook callback via HTTP POST', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks/payment/fawry')
        .send({
          orderStatus: 'PAID',
          merchantRefNumber: 'tx_e2e_fawry',
          fawryRefNumber: '99887766',
        });

      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(res.body?.message).toBe('Webhook processed successfully');
    });

    it('processes Paymob webhook callback via HTTP POST', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks/payment/paymob')
        .send({
          obj: {
            id: 887766,
            success: true,
            order: { merchant_order_id: 'tx_e2e_paymob' },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(res.body?.message).toBe('Webhook processed successfully');
    });

    it('processes PayPal webhook callback via HTTP POST', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks/payment/paypal')
        .send({
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: { id: 'cap_e2e_123', custom_id: 'tx_e2e_paypal' },
        });

      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(res.body?.message).toBe('Webhook processed successfully');
    });
  });
});
