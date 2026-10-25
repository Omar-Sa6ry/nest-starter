import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OAuthController } from './oauth.controller.js';
import { Role } from '../../../common/constant/enum.constant.js';

describe('OAuthController', () => {
  let controller: OAuthController;
  let mockOAuthService: any;
  let mockTokenProvider: any;
  let mockSessionStore: any;
  let mockConfigService: any;
  let mockEventEmitter: any;
  let mockLogger: any;
  let mockResponse: any;

  beforeEach(() => {
    mockOAuthService = {
      validateUser: vi.fn(),
    };

    mockTokenProvider = {
      generateTokens: vi.fn().mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
      }),
    };

    mockSessionStore = {
      createSession: vi.fn().mockResolvedValue(undefined),
      storeRefreshToken: vi.fn().mockResolvedValue(undefined),
    };

    mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'FRONTEND_URL') return 'http://localhost:5173';
        return null;
      }),
    };

    mockEventEmitter = {
      emit: vi.fn(),
    };

    mockLogger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockResponse = {
      redirect: vi.fn(),
    };

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
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: Role.USER,
      };
      const req: any = {
        user: {
          googleId: 'g-1',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      };

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
      const req: any = { user: { googleId: 'g-1' } };
      const error = new Error('Auth failed');

      mockOAuthService.validateUser.mockRejectedValue(error);

      await controller.googleCallback(req, mockResponse);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=Auth%20failed'),
      );
    });
  });
});
