import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Health endpoints', () => {
    it('GET /health returns UP status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('UP');
          expect(res.body.service).toBe('nest-starter');
          expect(res.body.system).toBeDefined();
        });
    });

    it('GET /health/ready returns UP with database and redis checks', () => {
      return request(app.getHttpServer())
        .get('/health/ready')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('UP');
          expect(res.body.checks.database.status).toBe('UP');
          expect(res.body.checks.redis.status).toBe('UP');
        });
    });
  });

  describe('Observability endpoints', () => {
    it('GET /metrics exposes Prometheus metrics', () => {
      return request(app.getHttpServer())
        .get('/metrics')
        .expect(200)
        .expect((res) => {
          expect(res.text).toContain('app_requests_total');
          expect(res.text).toContain('app_request_duration_seconds');
        });
    });

    it('records the health request in metrics', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);
      const res = await request(app.getHttpServer()).get('/metrics');
      expect(res.text).toMatch(/app_requests_total\{[^}]*path="\/health"/);
    });
  });

  describe('GraphQL API', () => {
    it('POST /graphql pingApp query returns success envelope', () => {
      return request(app.getHttpServer())
        .post('/graphql')
        .send({ query: '{ pingApp { success statusCode message data } }' })
        .expect(200)
        .expect((res) => {
          expect(res.body.errors).toBeUndefined();
          expect(res.body.data.pingApp.success).toBe(true);
          expect(res.body.data.pingApp.statusCode).toBe(200);
          expect(res.body.data.pingApp.data).toBe(true);
        });
    });

    it('POST /graphql returns formatted errors for unknown fields', () => {
      return request(app.getHttpServer())
        .post('/graphql')
        .send({ query: '{ definitelyNotAField }' })
        .expect(400)
        .expect((res) => {
          expect(Array.isArray(res.body.errors)).toBe(true);
          expect(res.body.errors[0].message).toContain(
            'Cannot query field',
          );
        });
    });
  });

  describe('HTTP 404', () => {
    it('unknown REST route returns 404', () => {
      return request(app.getHttpServer()).get('/definitely-missing').expect(404);
    });
  });
});
