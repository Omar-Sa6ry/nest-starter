import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import {
  UserType,
  UserResponse,
  ChangePasswordInput,
  UpdateProfileInput,
  PaginatedUsersResponse,
} from './dto/user.types.js';
import { BooleanResponse } from '../../common/graphql/general-response.type.js';
import { UserService } from './user.service.js';
import { Auth } from '../../common/decorator/auth.decorator.js';
import { Permission } from '../../common/constant/enum.constant.js';
import { CurrentUser } from '@bts-soft/core';
import { I18nService } from 'nestjs-i18n';
import type { IAuthenticatedUser } from '../../common/interfaces/IContext.interface.js';

@Resolver(() => UserType)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly i18n: I18nService,
  ) {}

  @Query(() => UserResponse)
  @Auth([Permission.VIEW_USER])
  async getUser(@Args('id') id: string): Promise<UserResponse> {
    const user = await this.userService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t('user.USER_RETRIEVED'),
      timeStamp: new Date().toISOString(),
      data: user as UserType,
    };
  }

  @Query(() => UserResponse)
  @Auth()
  async getMyProfile(
    @CurrentUser() currentUser: IAuthenticatedUser,
  ): Promise<UserResponse> {
    const user = await this.userService.findById(currentUser.id);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t('user.PROFILE_RETRIEVED'),
      timeStamp: new Date().toISOString(),
      data: user as UserType,
    };
  }

  @Query(() => PaginatedUsersResponse)
  @Auth([Permission.VIEW_USER])
  async getUsers(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number,
  ): Promise<PaginatedUsersResponse> {
    const res = await this.userService.findAll(page, limit);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t('user.USERS_RETRIEVED'),
      timeStamp: new Date().toISOString(),
      data: {
        paginationInfo: {
          totalItems: res.totalItems,
          currentPage: res.currentPage,
          nextPage: res.nextPage,
        },
        items: res.items as UserType[],
      },
    };
  }

  @Mutation(() => UserResponse)
  @Auth()
  async updateProfile(
    @CurrentUser() currentUser: IAuthenticatedUser,
    @Args('input') input: UpdateProfileInput,
  ): Promise<UserResponse> {
    const updated = await this.userService.updateProfile(currentUser.id, input);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t('user.PROFILE_UPDATED'),
      timeStamp: new Date().toISOString(),
      data: updated as UserType,
    };
  }

  @Mutation(() => BooleanResponse)
  @Auth()
  async changePassword(
    @CurrentUser() currentUser: IAuthenticatedUser,
    @Args('input') input: ChangePasswordInput,
  ): Promise<BooleanResponse> {
    await this.userService.changePassword(currentUser.id, input);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t('user.PASSWORD_CHANGED'),
      timeStamp: new Date().toISOString(),
      data: true,
    };
  }

  @Mutation(() => BooleanResponse)
  @Auth([Permission.EDIT_USER_ROLE])
  async promoteUserToAdmin(@Args('id') id: string): Promise<BooleanResponse> {
    await this.userService.promoteUserToAdmin(id);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t('user.ROLE_UPDATED'),
      timeStamp: new Date().toISOString(),
      data: true,
    };
  }

  @Mutation(() => BooleanResponse)
  @Auth([Permission.EDIT_USER_ROLE])
  async updateUserRole(
    @Args('id') id: string,
    @Args('role') role: string,
  ): Promise<BooleanResponse> {
    await this.userService.updateUserRole(id, role);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t('user.ROLE_UPDATED'),
      timeStamp: new Date().toISOString(),
      data: true,
    };
  }

  @Mutation(() => BooleanResponse)
  @Auth([Permission.DELETE_USER])
  async toggleUserActive(
    @Args('id') id: string,
    @Args('isActive') isActive: boolean,
  ): Promise<BooleanResponse> {
    await this.userService.toggleUserActive(id, isActive);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t('user.STATUS_UPDATED'),
      timeStamp: new Date().toISOString(),
      data: true,
    };
  }

  @Mutation(() => BooleanResponse)
  @Auth([Permission.DELETE_USER])
  async deleteUser(@Args('id') id: string): Promise<BooleanResponse> {
    await this.userService.deleteUser(id);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t('user.USER_DELETED'),
      timeStamp: new Date().toISOString(),
      data: true,
    };
  }
}
