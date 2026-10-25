import { ObjectType, Field, InputType, ID } from '@nestjs/graphql';
import { PasswordField, TextField } from '@bts-soft/core';
import { IsOptional, IsString } from 'class-validator';
import {
  GeneralResponse,
  PaginatedResponse,
} from '../../../common/graphql/general-response.type.js';

@ObjectType('User')
export class UserType {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  email: string;

  @Field(() => String)
  firstName: string;

  @Field(() => String)
  lastName: string;

  @Field(() => String)
  role: string;

  @Field(() => String, { nullable: true })
  phoneNumber?: string;

  @Field(() => Boolean)
  isActive: boolean;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => String, { nullable: true })
  imageUrl?: string;

  @Field(() => String, { nullable: true })
  googleId?: string;
}

@ObjectType()
export class UserResponse extends GeneralResponse(UserType) {}

@ObjectType()
export class PaginatedUsersResponse extends PaginatedResponse(UserType) {}

@InputType()
export class ChangePasswordInput {
  @PasswordField(8, 30, undefined, false, true, false)
  passwordOld: string;

  @PasswordField(8, 30, undefined, false, true, false)
  passwordNew: string;
}

@InputType()
export class UpdateProfileInput {
  @TextField('firstName', 2, 100, true, true, true)
  firstName?: string;

  @TextField('lastName', 2, 100, true, true, true)
  lastName?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
