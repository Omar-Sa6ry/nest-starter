import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from './user.service.js';
import { DbUserService } from './db-user.service.js';
import { Role } from '../../common/constant/enum.constant.js';

describe('UserService', () => {
  let service: UserService;
  let mockDbUserService: DbUserService;
  let mockCacheManager: Record<string, ReturnType<typeof vi.fn>>;

  const sampleUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed',
    firstName: 'Test',
    lastName: 'User',
    phoneNumber: '',
    role: Role.USER,
    isActive: true,
    imageUrl: undefined,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
  };

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mockDbUserService = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findAll: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      promoteUserToAdmin: vi.fn(),
      updateUserRole: vi.fn(),
      toggleUserActive: vi.fn(),
      deleteUser: vi.fn(),
      countUsersThisMonthAndLastMonth: vi.fn(),
    } as unknown as DbUserService;

    mockCacheManager = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    };

    service = new UserService(mockDbUserService, mockCacheManager);
  });

  describe('findById', () => {
    it('returns cached user when available', async () => {
      mockCacheManager.get.mockResolvedValue(sampleUser);

      const result = await service.findById('user-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('user-1');
      expect(mockCacheManager.get).toHaveBeenCalledWith('user:user-1');
      expect(mockDbUserService.findById).not.toHaveBeenCalled();
    });

    it('falls back to DB when cache miss', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      vi.mocked(mockDbUserService.findById).mockResolvedValue(sampleUser);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.findById('user-1');

      expect(mockDbUserService.findById).toHaveBeenCalledWith('user-1');
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'user:user-1',
        sampleUser,
        3600,
      );
      expect(result?.id).toBe('user-1');
    });

    it('returns null when user not found in DB', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      vi.mocked(mockDbUserService.findById).mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('handles cache errors gracefully', async () => {
      mockCacheManager.get.mockRejectedValue(new Error('Cache down'));
      vi.mocked(mockDbUserService.findById).mockResolvedValue(sampleUser);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.findById('user-1');

      expect(result?.id).toBe('user-1');
    });
  });

  describe('findByEmail', () => {
    it('delegates to DbUserService', async () => {
      vi.mocked(mockDbUserService.findByEmail).mockResolvedValue(sampleUser);

      const result = await service.findByEmail('test@example.com');

      expect(mockDbUserService.findByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(result?.id).toBe('user-1');
    });
  });

  describe('findAll', () => {
    it('delegates to DbUserService with pagination', async () => {
      const paginatedResult = {
        items: [sampleUser],
        totalItems: 1,
        currentPage: 1,
        nextPage: undefined,
      };
      vi.mocked(mockDbUserService.findAll).mockResolvedValue(paginatedResult);

      const result = await service.findAll(1, 10);

      expect(mockDbUserService.findAll).toHaveBeenCalledWith(1, 10);
      expect(result.totalItems).toBe(1);
    });
  });

  describe('updateProfile', () => {
    it('updates and refreshes cache', async () => {
      const updated = { ...sampleUser, firstName: 'Updated' };
      vi.mocked(mockDbUserService.updateProfile).mockResolvedValue(updated);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.updateProfile('user-1', {
        firstName: 'Updated',
      });

      expect(result.firstName).toBe('Updated');
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'user:user-1',
        updated,
        3600,
      );
    });
  });

  describe('deleteUser', () => {
    it('deletes and invalidates cache', async () => {
      vi.mocked(mockDbUserService.deleteUser).mockResolvedValue(true);
      mockCacheManager.del.mockResolvedValue(1);

      const result = await service.deleteUser('user-1');

      expect(result).toBe(true);
      expect(mockCacheManager.del).toHaveBeenCalledWith('user:user-1');
    });

    it('does not invalidate cache when deletion fails', async () => {
      vi.mocked(mockDbUserService.deleteUser).mockResolvedValue(false);

      const result = await service.deleteUser('nonexistent');

      expect(result).toBe(false);
      expect(mockCacheManager.del).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('delegates and refreshes cache', async () => {
      vi.mocked(mockDbUserService.changePassword).mockResolvedValue(
        sampleUser,
      );
      mockCacheManager.set.mockResolvedValue(undefined);

      await service.changePassword('user-1', {
        passwordOld: 'old',
        passwordNew: 'new',
      });

      expect(mockDbUserService.changePassword).toHaveBeenCalledWith('user-1', {
        passwordOld: 'old',
        passwordNew: 'new',
      });
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'user:user-1',
        sampleUser,
        3600,
      );
    });
  });

  describe('promoteUserToAdmin', () => {
    it('delegates and refreshes cache', async () => {
      vi.mocked(mockDbUserService.promoteUserToAdmin).mockResolvedValue(
        sampleUser,
      );
      mockCacheManager.set.mockResolvedValue(undefined);

      await service.promoteUserToAdmin('user-1');

      expect(mockDbUserService.promoteUserToAdmin).toHaveBeenCalledWith(
        'user-1',
      );
      expect(mockCacheManager.set).toHaveBeenCalled();
    });
  });

  describe('updateUserRole', () => {
    it('delegates and refreshes cache', async () => {
      vi.mocked(mockDbUserService.updateUserRole).mockResolvedValue(
        sampleUser,
      );
      mockCacheManager.set.mockResolvedValue(undefined);

      await service.updateUserRole('user-1', 'admin');

      expect(mockDbUserService.updateUserRole).toHaveBeenCalledWith(
        'user-1',
        'admin',
      );
      expect(mockCacheManager.set).toHaveBeenCalled();
    });
  });

  describe('toggleUserActive', () => {
    it('delegates and refreshes cache', async () => {
      vi.mocked(mockDbUserService.toggleUserActive).mockResolvedValue(
        sampleUser,
      );
      mockCacheManager.set.mockResolvedValue(undefined);

      await service.toggleUserActive('user-1', false);

      expect(mockDbUserService.toggleUserActive).toHaveBeenCalledWith(
        'user-1',
        false,
      );
      expect(mockCacheManager.set).toHaveBeenCalled();
    });
  });

  describe('countUsersThisMonthAndLastMonth', () => {
    it('delegates to DbUserService', async () => {
      const stats = {
        totalUsers: 100,
        usersThisMonth: 20,
        percentageIncrease: 25.5,
      };
      vi.mocked(
        mockDbUserService.countUsersThisMonthAndLastMonth,
      ).mockResolvedValue(stats);

      const result = await service.countUsersThisMonthAndLastMonth();

      expect(result).toEqual(stats);
    });
  });

  describe('without cacheManager', () => {
    it('falls back to DB for findById', async () => {
      const bare = new UserService(mockDbUserService);
      vi.mocked(mockDbUserService.findById).mockResolvedValue(sampleUser);

      const result = await bare.findById('user-1');

      expect(result?.id).toBe('user-1');
    });

    it('skips cache set on updateProfile', async () => {
      const bare = new UserService(mockDbUserService);
      vi.mocked(mockDbUserService.updateProfile).mockResolvedValue(sampleUser);

      const result = await bare.updateProfile('user-1', { firstName: 'X' });

      expect(result.id).toBe('user-1');
    });

    it('skips cache invalidation on deleteUser', async () => {
      const bare = new UserService(mockDbUserService);
      vi.mocked(mockDbUserService.deleteUser).mockResolvedValue(true);

      const result = await bare.deleteUser('user-1');

      expect(result).toBe(true);
    });
  });

  describe('cache errors on writes', () => {
    it('swallows setCache failures', async () => {
      mockCacheManager.set.mockRejectedValue(new Error('cache write failed'));
      vi.mocked(mockDbUserService.updateProfile).mockResolvedValue(sampleUser);

      await expect(
        service.updateProfile('user-1', { firstName: 'X' }),
      ).resolves.toMatchObject({ id: 'user-1' });
    });

    it('swallows invalidateCache failures', async () => {
      mockCacheManager.del.mockRejectedValue(new Error('cache del failed'));
      vi.mocked(mockDbUserService.deleteUser).mockResolvedValue(true);

      await expect(service.deleteUser('user-1')).resolves.toBe(true);
    });
  });
});
