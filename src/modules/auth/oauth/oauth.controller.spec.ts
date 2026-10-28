import { describe, it, expect, beforeEach, vi, type Mocked } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { Request, Response } from 'express';
import { OAuthController } from './oauth.controller.js';
import type { OAuthService } from './oauth.service.js';
import type {
  ITokenProvider,
  ISessionStore,
} from '../../../common/interfaces/ISecurity.interface.js';
import type { StructuredLogger } from '../../../common/logging/logger.service.js';
import { User } from '../../user/entity/user.entity.js';
import { Role } from '../../../common/constant/enum.constant.js';

describe('OAuthController', () => {
  let controller: OAuthController;
  let mockOAuthService: Mocked<OAuthService>;
  let mockTokenProvider: Mocked<ITokenProvider>;
  let mockSessionStore: Mocked<ISessionStore>;
  let mockConfigService: Mocked<ConfigService>;
  let mockEventEmitter: Mocked<EventEmitter2>;
  let mockLogger: Mocked<StructuredLogger>;
  let mockResponse: Mocked<Response>;

  beforeEach(() => {
    mockOAuthService = {
      validateUser: vi.fn<OAuthService['validateUser']>(),
    } as unknown as Mocked<OAuthService>;

    mockTokenProvider = {
      generateTokens: vi.fn<ITokenProvider['generateTokens']>().mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
      }),
    } as unknown as Mocked<ITokenProvider>;

    mockSessionStore = {
      createSession: vi.fn<ISessionStore['createSession']>().mockResolvedValue(undefined),
      storeRefreshToken: vi.fn<ISessionStore['storeRefreshToken']>().mockResolvedValue(undefined),
    } as unknown as Mocked<ISessionStore>;

    mockConfigService = {
      get: vi.fn((key: string) =>
        key === 'FRONTEND_URL' ? 'http://localhost:5173' : null,
      ),
    } as unknown as Mocked<ConfigService>;

    mockEventEmitter = {
      emit: vi.fn(),
    } as unknown as Mocked<EventEmitter2>;

    mockLogger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Mocked<StructuredLogger>;

    mockResponse = {
      redirect: vi.fn(),
    } as unknown as Mocked<Response>;

    controller = new OAuthController(
      mockOAuthService,
      mockTokenProvider,
      mockSessionStore,
      mockConfigService,
      mockEventEmitter,
      mockLogger,
    );
  });

  describe('googleCallback', () => {
    it('should create session and redirect to frontend with tokens on success', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: Role.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const req = {
        user: {
          googleId: 'g-1',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      } as unknown as Request;

      mockOAuthService.validateUser.mockResolvedValue(mockUser);

      await controller.googleCallback(req, mockResponse);

      expect(mockOAuthService.validateUser).toHaveBeenCalledWith(req.user);
      expect(mockTokenProvider.generateTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
        }),
      );
      expect(mockSessionStore.createSession).toHaveBeenCalled();
      expect(mockSessionStore.storeRefreshToken).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'user.logged_in',
        expect.anything(),
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('token=mock-access-token'),
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('refreshToken=mock-refresh-token'),
      );
    });

    it('should redirect with error parameter if authentication fails', async () => {
      const req = { user: { googleId: 'g-1' } } as unknown as Request;
      const error = new Error('Auth failed');

      mockOAuthService.validateUser.mockRejectedValue(error);

      await controller.googleCallback(req, mockResponse);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=Auth%20failed'),
      );
    });
  });
});
