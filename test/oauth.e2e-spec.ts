import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, type ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { OAuthService } from '../src/modules/auth/oauth/oauth.service.js';
import { AuthGuard } from '@nestjs/passport';

describe('OAuth (e2e)', () => {
  let app: INestApplication;
  let oauthService: OAuthService;

  const mockGoogleProfile = {
    googleId: 'google-test-id-12345',
    email: 'oauth.test@example.com',
    firstName: 'TestOAuth',
    lastName: 'User',
    imageUrl: 'https://example.com/photo.png',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(AuthGuard('google'))
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{
            user: typeof mockGoogleProfile;
          }>();
          req.user = mockGoogleProfile;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    oauthService = app.get<OAuthService>(OAuthService);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /auth/google', () => {
    it('should be handled by Google AuthGuard', () => {
      return request(app.getHttpServer())
        .get('/auth/google')
        .expect(200);
    });
  });

  describe('GET /auth/google/callback', () => {
    it('redirects to frontend callback with JWT token and user info upon successful auth', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .expect(302);

      const location = response.header.location;
      expect(location).toBeDefined();
      expect(location).toContain('/auth/callback?');
      expect(location).toContain('token=');
      expect(location).toContain('refreshToken=');
      expect(location).toContain(`email=${encodeURIComponent(mockGoogleProfile.email)}`);
      expect(location).toContain(`firstName=${encodeURIComponent(mockGoogleProfile.firstName)}`);
    });

    it('redirects with error parameter if oauth service throws an exception', async () => {
      const spy = vi
        .spyOn(oauthService, 'validateUser')
        .mockRejectedValueOnce(new Error('Google verification failed'));

      const response = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .expect(302);

      const location = response.header.location;
      expect(location).toContain('/auth/callback?error=Google%20verification%20failed');

      spy.mockRestore();
    });
  });
});
