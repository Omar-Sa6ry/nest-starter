import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { RedisService } from '@bts-soft/core';
import { Role } from '../../common/constant/enum.constant.js';
import { UpdateProfileInput, ChangePasswordInput } from './dto/user.types.js';
import { DbUserService } from './db-user.service.js';
import { User } from './entity/user.entity.js';
import { IPaginatedResult } from '../../common/interfaces/IPaginatedResult.interface.js';
import { IUserStats } from './interfaces/IUserStats.interface.js';

@Injectable()
export class UserService {
  private readonly logger: Logger;

  constructor(
    private readonly dbUserService: DbUserService,
    @Optional() private readonly redisService?: RedisService,
  ) {
    this.logger = new Logger(UserService.name);
  }

  getCacheKey(id: string): string {
    return `user:${id}`;
  }

  async getCached(id: string): Promise<User | null> {
    if (!this.redisService) return null;
    try {
      const cached = await this.redisService.get(this.getCacheKey(id));
      if (cached) {
        const user = cached as User;
        if (user.createdAt) user.createdAt = new Date(user.createdAt);
        if (user.updatedAt) user.updatedAt = new Date(user.updatedAt);
        if (user.deletedAt) user.deletedAt = new Date(user.deletedAt);
        return user;
      }
    } catch {
      // fallback to DB
    }
    return null;
  }

  async setCache(id: string, entity: User): Promise<void> {
    if (!this.redisService) return;
    try {
      await this.redisService.set(
        this.getCacheKey(id),
        entity,
        this.cacheTtlSeconds,
      );
    } catch {
      // fallback to DB
    }
  }

  async invalidateCache(id: string): Promise<void> {
    if (!this.redisService) return;
    try {
      await this.redisService.del(this.getCacheKey(id));
    } catch {
      // fallback to DB
    }
  }

  protected get cacheTtlSeconds(): number {
    return 3600;
  }

  protected findByIdFromDb(id: string): Promise<User | null> {
    return this.dbUserService.findById(id);
  }

  async findById(id: string): Promise<User | null> {
    const cached = await this.getCached(id);
    if (cached) return cached;

    const entity = await this.findByIdFromDb(id);
    if (entity) {
      await this.setCache(id, entity);
    }
    return entity;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.dbUserService.findByEmail(email);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<IPaginatedResult<User>> {
    return this.dbUserService.findAll(page, limit);
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<User> {
    const updatedUser = await this.dbUserService.updateProfile(userId, input);
    await this.setCache(userId, updatedUser);
    this.logger.log(`Profile updated for user: ${userId}`, 'UserService');
    return updatedUser;
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<void> {
    const updatedUser = await this.dbUserService.changePassword(userId, input);
    await this.setCache(userId, updatedUser);
    this.logger.log(`Password changed for user: ${userId}`, 'UserService');
  }

  async promoteUserToAdmin(id: string): Promise<void> {
    const updatedUser = await this.dbUserService.promoteUserToAdmin(id);
    await this.setCache(id, updatedUser);
    this.logger.log(`User promoted to admin: ${id}`, 'UserService');
  }

  async updateUserRole(id: string, role: Role): Promise<void> {
    const updatedUser = await this.dbUserService.updateUserRole(id, role);
    await this.setCache(id, updatedUser);
    this.logger.log(`Role updated for user ${id}: ${role}`, 'UserService');
  }

  async toggleUserActive(id: string, isActive: boolean): Promise<void> {
    const user = await this.findById(id);
    if (!user || user.role === Role.ADMIN) {
      throw new UnauthorizedException(
        `You are not allowed to ${isActive ? 'activate' : 'deactivate'} this user`,
      );
    }

    const updatedUser = await this.dbUserService.toggleUserActive(id, isActive);
    await this.setCache(id, updatedUser);
    this.logger.log(
      `User ${id} active status set to ${isActive}`,
      'UserService',
    );
  }

  async deleteUser(id: string): Promise<boolean> {
    const deleted = await this.dbUserService.deleteUser(id);
    if (deleted) {
      await this.invalidateCache(id);
      this.logger.log(`User deleted: ${id}`, 'UserService');
    }
    return deleted;
  }

  async countUsersThisMonthAndLastMonth(): Promise<IUserStats> {
    return this.dbUserService.countUsersThisMonthAndLastMonth();
  }
}
