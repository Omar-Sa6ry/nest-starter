import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { RoleGuard } from '../src/common/guard/role.guard.js';
import { Role, Permission } from '../src/common/constant/enum.constant.js';
import type { IAuthenticatedRequest } from '../src/common/interfaces/IContext.interface.js';

describe('Notification (e2e)', { timeout: 60_000 }, () => {
  let app: INestApplication;

  const mockAdminUser = {
    id: 'admin-e2e-id',
    email: 'admin@example.com',
    role: Role.ADMIN,
    permissions: [
      Permission.NOTIFICATION_SEND,
      Permission.NOTIFICATION_MANAGE,
    ],
  };

  const mockNormalUser = {
    id: 'user-e2e-1',
    email: 'user1@example.com',
    role: Role.USER,
    permissions: [],
  };

  let currentUserContext = mockAdminUser;

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
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GraphQL Notification Mutations & Queries', () => {
    it('dispatches a notification successfully through sendNotification mutation', async () => {
      currentUserContext = mockAdminUser;
      const mutation = `
        mutation {
          sendNotification(input: {
            channel: EMAIL,
            recipientId: "starter-test@example.com",
            subject: "Test Subject",
            body: "Hello from e2e test",
            priority: HIGH,
            category: TRANSACTIONAL
          }) {
            success
            statusCode
            message
            timeStamp
            data {
              jobId
              channel
              recipientId
              status
            }
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query: mutation })
        .expect(200);

      expect(res.body.errors).toBeUndefined();
      const payload = res.body.data.sendNotification;
      expect(payload.success).toBe(true);
      expect(payload.statusCode).toBe(200);
      expect(payload.message).toBeDefined();
      expect(payload.data.recipientId).toBe('starter-test@example.com');
      expect(payload.data.channel).toBe('EMAIL');
    });

    it('updates user notification preferences and reads them back (Self Ownership)', async () => {
      currentUserContext = mockNormalUser;
      const updateMutation = `
        mutation {
          updateNotificationPreferences(input: {
            recipientId: "user-e2e-1",
            channel: EMAIL,
            optOut: true
          }) {
            success
            statusCode
            message
            data {
              recipientId
              channel
              isOptedOut
            }
          }
        }
      `;

      const updateRes = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query: updateMutation })
        .expect(200);

      expect(updateRes.body.errors).toBeUndefined();
      expect(
        updateRes.body.data.updateNotificationPreferences.data.isOptedOut,
      ).toBe(true);

      const query = `
        query {
          getNotificationPreferenceStatus(
            recipientId: "user-e2e-1",
            channel: EMAIL
          ) {
            success
            statusCode
            data {
              recipientId
              channel
              isOptedOut
            }
          }
        }
      `;

      const queryRes = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query })
        .expect(200);

      expect(queryRes.body.errors).toBeUndefined();
      expect(
        queryRes.body.data.getNotificationPreferenceStatus.data.isOptedOut,
      ).toBe(true);
    });

    it('rejects preference access when a regular user attempts to access another user preferences', async () => {
      currentUserContext = mockNormalUser;
      const forbiddenQuery = `
        query {
          getNotificationPreferenceStatus(
            recipientId: "another-different-user-id",
            channel: EMAIL
          ) {
            success
            statusCode
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query: forbiddenQuery })
        .expect(200);

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].statusCode).toBe(403);
      expect(res.body.errors[0].message).toContain('permissions');
    });

    it('allows admin to query DLQ failure statistics and job diagnostics', async () => {
      currentUserContext = mockAdminUser;
      const statsQuery = `
        query {
          getNotificationDlqStats {
            success
            statusCode
            message
            data {
              totalFailed
            }
          }
          getNotificationDlqFailedJobs(channel: EMAIL) {
            jobId
            channel
            failedReason
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query: statsQuery })
        .expect(200);

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.getNotificationDlqStats.success).toBe(true);
      expect(
        typeof res.body.data.getNotificationDlqStats.data.totalFailed,
      ).toBe('number');
      expect(Array.isArray(res.body.data.getNotificationDlqFailedJobs)).toBe(
        true,
      );
    });

    it('allows admin to purge DLQ failed jobs', async () => {
      currentUserContext = mockAdminUser;
      const purgeMutation = `
        mutation {
          purgeNotificationDlq(channel: EMAIL) {
            success
            statusCode
            message
            data
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query: purgeMutation })
        .expect(200);

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.purgeNotificationDlq.success).toBe(true);
      expect(typeof res.body.data.purgeNotificationDlq.data).toBe('number');
    });

    it('translates success message to Arabic when x-lang header is set to ar', async () => {
      currentUserContext = mockAdminUser;
      const query = `
        query {
          getNotificationDlqStats {
            success
            statusCode
            message
            data {
              totalFailed
            }
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .set('x-lang', 'ar')
        .send({ query })
        .expect(200);

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.getNotificationDlqStats.message).toContain('تم');
    });
  });
});
