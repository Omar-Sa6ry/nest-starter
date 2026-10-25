import { Injectable, Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../../user/entity/user.entity.js';
import { Role } from '../../../common/constant/enum.constant.js';
import { GoogleUserData } from './interfaces/google.interface.js';
import { UserFactory } from '../factory/user.factory.js';

@Injectable()
export class OAuthService {
  constructor(
    @Inject('USER_REPOSITORY')
    private readonly userRepo: Repository<User>,
    private readonly userFactory: UserFactory,
  ) {}

  async validateUser(userData: GoogleUserData): Promise<User> {
    const email = userData.email?.trim().toLowerCase();
    const phone = userData.phone?.trim();

    // 1. Try finding by googleId first, or by email, or by phone if provided
    const searchConditions: Record<string, string>[] = [{ googleId: userData.googleId }];
    if (email) searchConditions.push({ email });
    if (phone) searchConditions.push({ phoneNumber: phone });

    let user = await this.userRepo.findOne({
      where: searchConditions,
    });

    if (user) {
      let needsSave = false;
      if (!user.googleId) {
        user.googleId = userData.googleId;
        needsSave = true;
      }
      if (!user.phoneNumber && phone) {
        user.phoneNumber = phone;
        needsSave = true;
      }
      if (!user.imageUrl && userData.imageUrl) {
        user.imageUrl = userData.imageUrl;
        needsSave = true;
      }
      if (needsSave) {
        user = await this.userRepo.save(user);
      }
      return user;
    }

    // 2. If user doesn't exist, create a new one
    const userCount = await this.userRepo.count();
    const role = userCount === 0 ? Role.ADMIN : Role.USER;

    const newUser = this.userFactory.createUser(
      email || `${userData.googleId}@google.oauth`,
      undefined,
      userData.firstName,
      userData.lastName,
      role,
      phone,
      userData.imageUrl,
      userData.googleId,
    );

    return this.userRepo.save(newUser);
  }
}
