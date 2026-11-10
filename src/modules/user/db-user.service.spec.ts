import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { DbUserService } from './db-user.service.js';
import { Role } from '../../common/constant/enum.constant.js';
import type { MediaService } from '../media/services/media.service.js';
import type { MediaType } from '../media/dto/media.types.js';

describe('DbUserService', () => {
  let service: DbUserService;
  let mockRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockHasher: Record<string, ReturnType<typeof vi.fn>>;
  let mockMediaService: Partial<MediaService>;
  const mockI18n = { t: vi.fn((key: string) => key) };

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
    vi.clearAllMocks();

    mockRepo = {
      findOne: vi.fn(),
      findAndCount: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      softDelete: vi.fn(),
      count: vi.fn(),
    };

    mockHasher = {
      compare: vi.fn(),
      hash: vi.fn(),
    };

    mockMediaService = {
      findById: vi.fn().mockResolvedValue({
        id: 'media-1',
        mediaId: 'media-1',
        fileName: 'avatar.png',
      } as unknown as MediaType),
      getDownloadUrl: vi.fn().mockResolvedValue({
        downloadUrl: 'https://example.com/avatar.png',
        expiresIn: 3600,
      }),
    };

    service = new DbUserService(
      mockRepo as never,
      mockHasher as never,
      mockI18n as never,
      mockMediaService as MediaService,
    );
  });

  describe('findById', () => {
    it('returns the user', async () => {
      mockRepo.findOne.mockResolvedValue(sampleUser);

      const result = await service.findById('user-1');

      expect(result).toBe(sampleUser);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('throws when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('normalizes the email', async () => {
      mockRepo.findOne.mockResolvedValue(sampleUser);

      await service.findByEmail('  TEST@Example.com  ');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('findAll', () => {
    it('paginates results', async () => {
      mockRepo.findAndCount.mockResolvedValue([[sampleUser], 10]);

      const result = await service.findAll(1, 5);

      expect(result.items).toHaveLength(1);
      expect(result.totalItems).toBe(10);
      expect(result.currentPage).toBe(1);
      expect(result.nextPage).toBe(2);
      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 5,
        order: { createdAt: 'DESC' },
      });
    });

    it('returns undefined nextPage on last page', async () => {
      mockRepo.findAndCount.mockResolvedValue([[sampleUser], 3]);

      const result = await service.findAll(1, 5);

      expect(result.nextPage).toBeUndefined();
    });
  });

  describe('updateProfile', () => {
    it('updates provided fields with avatarMediaId', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });
      mockRepo.save.mockImplementation((u: unknown) => u);

      const result = await service.updateProfile('user-1', {
        firstName: 'New',
        lastName: 'Name',
        avatarMediaId: 'media-1',
      });

      expect(result.firstName).toBe('New');
      expect(result.lastName).toBe('Name');
      expect(result.imageUrl).toBe('https://example.com/avatar.png');
      expect(mockMediaService.findById).toHaveBeenCalledWith('media-1');
      expect(mockMediaService.getDownloadUrl).toHaveBeenCalledWith(
        'user-1',
        'media-1',
      );
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('throws when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('missing', { firstName: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws on invalid avatar media id if not found', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });
      vi.mocked(mockMediaService.findById!).mockRejectedValue(
        new NotFoundException('Media not found'),
      );

      await expect(
        service.updateProfile('user-1', { avatarMediaId: 'non-existent' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('hashes and saves the new password', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });
      mockHasher.compare.mockResolvedValue(true);
      mockHasher.hash.mockResolvedValue('new-hash');
      mockRepo.save.mockImplementation((u: unknown) => u);

      await service.changePassword('user-1', {
        passwordOld: 'old',
        passwordNew: 'new',
      });

      expect(mockHasher.compare).toHaveBeenCalledWith('old', 'hashed');
      expect(mockHasher.hash).toHaveBeenCalledWith('new');
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'new-hash' }),
      );
    });

    it('throws when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword('user-1', {
          passwordOld: 'o',
          passwordNew: 'n',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws on wrong old password', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });
      mockHasher.compare.mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', {
          passwordOld: 'wrong',
          passwordNew: 'n',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('promoteUserToAdmin', () => {
    it('sets role to admin', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });
      mockRepo.save.mockImplementation((u: unknown) => u);

      const result = await service.promoteUserToAdmin('user-1');

      expect(result.role).toBe(Role.ADMIN);
    });

    it('throws when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.promoteUserToAdmin('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUserRole', () => {
    it('applies a valid role', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });
      mockRepo.save.mockImplementation((u: unknown) => u);

      const result = await service.updateUserRole('user-1', Role.ADMIN);

      expect(result.role).toBe(Role.ADMIN);
    });

    it('throws when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.updateUserRole('user-1', Role.ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('toggleUserActive', () => {
    it('updates active flag', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });
      mockRepo.save.mockImplementation((u: unknown) => u);

      const result = await service.toggleUserActive('user-1', false);

      expect(result.isActive).toBe(false);
    });

    it('throws when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.toggleUserActive('user-1', false)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteUser', () => {
    it('deletes and reports affected rows', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });
      mockRepo.softDelete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteUser('user-1');

      expect(result).toBe(true);
      expect(mockRepo.softDelete).toHaveBeenCalledWith('user-1');
    });

    it('returns false when nothing affected', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });
      mockRepo.softDelete.mockResolvedValue({ affected: 0 });

      const result = await service.deleteUser('user-1');

      expect(result).toBe(false);
    });

    it('throws when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteUser('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('countUsersThisMonthAndLastMonth', () => {
    it('computes stats with increase percentage', async () => {
      mockRepo.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20) // this month
        .mockResolvedValueOnce(10); // last month

      const result = await service.countUsersThisMonthAndLastMonth();

      expect(result.totalUsers).toBe(100);
      expect(result.usersThisMonth).toBe(20);
      expect(result.percentageIncrease).toBe(100);
    });

    it('returns 100 when last month had zero users', async () => {
      mockRepo.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(0);

      const result = await service.countUsersThisMonthAndLastMonth();

      expect(result.percentageIncrease).toBe(100);
    });
  });
});
