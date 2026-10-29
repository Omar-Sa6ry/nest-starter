import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between } from 'typeorm';
import type { IPasswordHasher } from '../../common/interfaces/ISecurity.interface.js';
import { PASSWORD_HASHER } from '../../common/security/tokens/injection.tokens.js';
import { Role } from '../../common/constant/enum.constant.js';
import { I18nService } from 'nestjs-i18n';
import { UpdateProfileInput, ChangePasswordInput } from './dto/user.types.js';
import { User } from './entity/user.entity.js';
import { IUserStats } from './interfaces/IUserStats.interface.js';
import { IPaginatedResult } from '../../common/interfaces/IPaginatedResult.interface.js';
import { USER_I18N } from './constants/user-i18n.constants.js';

@Injectable()
export class DbUserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
    private readonly i18n: I18nService,
  ) {}

  async findById(id: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { id },
    });

    if (!user) throw new NotFoundException(this.i18n.t(USER_I18N.NOT_FOUND));
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) throw new NotFoundException(this.i18n.t(USER_I18N.NOT_FOUND));
    return user;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<IPaginatedResult<User>> {
    const skip = (page - 1) * limit;
    const [items, totalItems] = await this.userRepo.findAndCount({
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    if (items.length === 0)
      throw new NotFoundException(this.i18n.t(USER_I18N.NOT_FOUNDS));

    const hasNext = page * limit < totalItems;
    return {
      items,
      totalItems,
      currentPage: page,
      nextPage: hasNext ? page + 1 : undefined,
    };
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new BadRequestException(this.i18n.t(USER_I18N.NOT_FOUND));
    }

    const { firstName, lastName, imageUrl } = input;
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;

    if (imageUrl) {
      if (!isHttpUrl(imageUrl)) {
        throw new BadRequestException(this.i18n.t(USER_I18N.INVALID_IMAGE_URL));
      }
      user.imageUrl = imageUrl;
    }

    return this.userRepo.save(user);
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user || !user.passwordHash)
      throw new BadRequestException(this.i18n.t(USER_I18N.INVALID_CREDENTIALS));

    const isValid = await this.passwordHasher.compare(
      input.passwordOld,
      user.passwordHash,
    );
    if (!isValid)
      throw new UnauthorizedException(this.i18n.t(USER_I18N.INVALID_PASSWORD));

    user.passwordHash = await this.passwordHasher.hash(input.passwordNew);
    return this.userRepo.save(user);
  }

  async promoteUserToAdmin(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(this.i18n.t(USER_I18N.NOT_FOUND));

    user.role = Role.ADMIN;
    return this.userRepo.save(user);
  }

  async updateUserRole(id: string, role: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(this.i18n.t(USER_I18N.NOT_FOUND));
    }

    const normalizedRole = role.toLowerCase() as Role;
    user.role = Object.values(Role).includes(normalizedRole)
      ? normalizedRole
      : (role as Role);
    return this.userRepo.save(user);
  }

  async toggleUserActive(id: string, isActive: boolean): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(this.i18n.t(USER_I18N.NOT_FOUND));
    }

    user.isActive = isActive;
    return this.userRepo.save(user);
  }

  async deleteUser(id: string): Promise<boolean> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(this.i18n.t(USER_I18N.NOT_FOUND));
    }

    const result = await this.userRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async countUsersThisMonthAndLastMonth(): Promise<IUserStats> {
    const totalUsers = await this.userRepo.count({
      where: { role: Role.USER },
    });
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const usersThisMonth = await this.userRepo.count({
      where: { role: Role.USER, createdAt: MoreThanOrEqual(startOfMonth) },
    });

    const usersLastMonth = await this.userRepo.count({
      where: {
        role: Role.USER,
        createdAt: Between(startOfLastMonth, endOfLastMonth),
      },
    });

    const percentageIncrease = usersLastMonth
      ? Number(
          (((usersThisMonth - usersLastMonth) / usersLastMonth) * 100).toFixed(
            2,
          ),
        )
      : 100;

    return { totalUsers, usersThisMonth, percentageIncrease };
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
