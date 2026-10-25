import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OAuthService } from './oauth.service.js';
import { Role } from '../../../common/constant/enum.constant.js';
import { UserFactory } from '../factory/user.factory.js';
import { GoogleUserData } from './interfaces/google.interface.js';
import { User } from '../../user/entity/user.entity.js';

describe('OAuthService', () => {
  let service: OAuthService;
  let mockUserRepo: any;
  let userFactory: UserFactory;

  const mockGoogleUserData: GoogleUserData = {
    googleId: 'google-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    imageUrl: 'https://example.com/avatar.jpg',
  };

  beforeEach(() => {
    mockUserRepo = {
      findOne: vi.fn(),
      save: vi.fn().mockImplementation((user) => Promise.resolve(user)),
      count: vi.fn(),
    };
    userFactory = new UserFactory();
    service = new OAuthService(mockUserRepo, userFactory);
  });

  describe('validateUser', () => {
    it('should return existing user if they already have a googleId', async () => {
      const existingUser = new User();
      existingUser.id = '1';
      existingUser.email = 'test@example.com';
      existingUser.googleId = 'google-123';
      existingUser.imageUrl = 'https://example.com/avatar.jpg';

      mockUserRepo.findOne.mockResolvedValue(existingUser);

      const result = await service.validateUser(mockGoogleUserData);

      expect(mockUserRepo.findOne).toHaveBeenCalled();
      expect(result.id).toBe(existingUser.id);
      expect(mockUserRepo.save).not.toHaveBeenCalled();
    });

    it('should update and return user if they exist by email but lack a googleId', async () => {
      const userWithoutGoogleId = new User();
      userWithoutGoogleId.id = '1';
      userWithoutGoogleId.email = 'test@example.com';

      mockUserRepo.findOne.mockResolvedValue(userWithoutGoogleId);

      const result = await service.validateUser(mockGoogleUserData);

      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          googleId: 'google-123',
          imageUrl: 'https://example.com/avatar.jpg',
        }),
      );
      expect(result.googleId).toBe('google-123');
    });

    it('should create a new ADMIN user if no users exist in database', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.count.mockResolvedValue(0);

      const result = await service.validateUser(mockGoogleUserData);

      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          role: Role.ADMIN,
          googleId: 'google-123',
        }),
      );
      expect(result.role).toBe(Role.ADMIN);
    });

    it('should create a new USER if other users exist in database', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.count.mockResolvedValue(10);

      const result = await service.validateUser(mockGoogleUserData);

      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          role: Role.USER,
          googleId: 'google-123',
        }),
      );
      expect(result.role).toBe(Role.USER);
    });
  });
});
