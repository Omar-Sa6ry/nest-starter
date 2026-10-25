import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { DbUserService } from './db-user.service.js';
import { Role } from '../../common/constant/enum.constant.js';

describe('DbUserService', () => {
  let service: DbUserService;
  let mockRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockHasher: Record<string, ReturnType<typeof vi.fn>>;
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
      count: vi.fn(),
    };

    mockHasher = {
      compare: vi.fn(),
      hash: vi.fn(),
    };

    service = new DbUserService(
      mockRepo as never,
      mockHasher as never,
      mockI18n as never,
    );
  });

  describe('findById', () => {
    it('returns the user', async () => {
      mockRepo.findOne.mockResolvedValue(sampleUser);

      const result = await service.findById('user-1');

      expect(result).toEqual(sampleUser);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });
  });

  describe('findByEmail', () => {
    it('normalizes the email', async () => {
      mockRepo.findOne.mockResolvedValue(sampleUser);

      await service.findByEmail('  TEST@Example.com ');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('findAll', () => {
    it('paginates results', async () => {
      mockRepo.findAndCount.mockResolvedValue([[sampleUser], 25]);

      const result = await service.findAll(2, 10);

      expect(result.items).toEqual([sampleUser]);
      expect(result.totalItems).toBe(25);
      expect(result.currentPage).toBe(2);
      expect(result.nextPage).toBe(3);
      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        skip: 10,
        take: 10,
        order: { createdAt: 'DESC' },
      });
    });

    it('returns undefined nextPage on last page', async () => {
      mockRepo.findAndCount.mockResolvedValue([[sampleUser], 15]);

      const result = await service.findAll(2, 10);

      expect(result.nextPage).toBeUndefined();
    });
  });

  describe('updateProfile', () => {
    it('updates provided fields', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });
      mockRepo.save.mockImplementation((u: unknown) => u);

      const result = await service.updateProfile('user-1', {
        firstName: 'New',
        lastName: 'Name',
        imageUrl: 'https://example.com/a.png',
      });

      expect(result.firstName).toBe('New');
      expect(result.lastName).toBe('Name');
      expect(result.imageUrl).toBe('https://example.com/a.png');
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('throws when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('missing', { firstName: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws on invalid image url', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });

      await expect(
        service.updateProfile('user-1', { imageUrl: 'not-a-url' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('hashes and saves the new password', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });
      mockHasher.compare.mockResolvedValue(true);
      mockHasher.hash.mockResolvedValue('new-hash');
      mockRepo.save.mockImplementation((u: unknown) => u);

      const result = await service.changePassword('user-1', {
        passwordOld: 'old',
        passwordNew: 'new',
      });

      expect(result.passwordHash).toBe('new-hash');
      expect(mockHasher.compare).toHaveBeenCalledWith('old', 'hashed');
      expect(mockHasher.hash).toHaveBeenCalledWith('new');
    });

    it('throws when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword('missing', {
          passwordOld: 'a',
          passwordNew: 'b',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws on wrong old password', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });
      mockHasher.compare.mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', {
          passwordOld: 'wrong',
          passwordNew: 'new',
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

      await expect(service.promoteUserToAdmin('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUserRole', () => {
    it('normalizes and applies a valid role', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });
      mockRepo.save.mockImplementation((u: unknown) => u);

      const result = await service.updateUserRole('user-1', 'ADMIN');

      expect(result.role).toBe(Role.ADMIN);
    });

    it('keeps raw role when not in enum', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });
      mockRepo.save.mockImplementation((u: unknown) => u);

      const result = await service.updateUserRole('user-1', 'CUSTOM');

      expect(result.role).toBe('CUSTOM');
    });

    it('throws when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.updateUserRole('missing', 'user')).rejects.toThrow(
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

      await expect(service.toggleUserActive('missing', true)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteUser', () => {
    it('deletes and reports affected rows', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteUser('user-1');

      expect(result).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith('user-1');
    });

    it('returns false when nothing affected', async () => {
      mockRepo.findOne.mockResolvedValue({ ...sampleUser });
      mockRepo.delete.mockResolvedValue({ affected: 0 });

      const result = await service.deleteUser('user-1');

      expect(result).toBe(false);
    });

    it('throws when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteUser('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('countUsersThisMonthAndLastMonth', () => {
    it('computes stats with increase percentage', async () => {
      mockRepo.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(10);

      const result = await service.countUsersThisMonthAndLastMonth();

      expect(result.totalUsers).toBe(100);
      expect(result.usersThisMonth).toBe(20);
      expect(result.percentageIncrease).toBe(100);
    });

    it('returns 100 when last month had zero users', async () => {
      mockRepo.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(0);

      const result = await service.countUsersThisMonthAndLastMonth();

      expect(result.percentageIncrease).toBe(100);
    });
  });
});
