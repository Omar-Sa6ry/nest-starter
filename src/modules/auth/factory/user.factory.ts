import { Injectable } from '@nestjs/common';
import { IdGenerator } from '@bts-soft/core';
import { User } from '../../user/entity/user.entity.js';
import { Role } from '../../../common/constant/enum.constant.js';

@Injectable()
export class UserFactory {
  createUser(
    email: string,
    passwordHash?: string,
    firstName: string = '',
    lastName: string = '',
    role: Role = Role.USER,
    phoneNumber?: string,
    imageUrl?: string,
    googleId?: string,
  ): User {
    const user = new User();
    user.id = IdGenerator.generate('snowflake');
    user.email = email.trim().toLowerCase();
    user.passwordHash = passwordHash;
    user.firstName = firstName;
    user.lastName = lastName;
    user.phoneNumber = phoneNumber ? phoneNumber.trim() : '';
    user.role = role;
    user.isActive = true;
    user.imageUrl = imageUrl;
    user.googleId = googleId;
    return user;
  }
}
