import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import {
  UserType,
  UserResponse,
  ChangePasswordInput,
  UpdateProfileInput,
  PaginatedUsersResponse,
  UserStatsResponse,
} from './dto/user.types.js';
import { BooleanResponse } from '../../common/graphql/general-response.type.js';
import { UserService } from './user.service.js';
import { Auth } from '../../common/decorator/auth.decorator.js';
import { Permission, Role } from '../../common/constant/enum.constant.js';
import { CurrentUser } from '@bts-soft/core';
import { I18nService } from 'nestjs-i18n';
import type { IAuthenticatedUser } from '../../common/interfaces/IContext.interface.js';
import { USER_I18N } from './constants/user-i18n.constants.js';

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
      message: await this.i18n.t(USER_I18N.USER_RETRIEVED),
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
      message: await this.i18n.t(USER_I18N.PROFILE_RETRIEVED),
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
      message: await this.i18n.t(USER_I18N.USERS_RETRIEVED),
      timeStamp: new Date().toISOString(),
      data: {
        paginationInfo: {
          totalItems: res.totalItems,
          currentPage: res.currentPage,
          totalPages: res.totalPages,
          limit: res.limit,
          hasNextPage: res.hasNextPage,
          hasPreviousPage: res.hasPreviousPage,
          previousPage: res.previousPage,
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
      message: await this.i18n.t(USER_I18N.PROFILE_UPDATED),
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
      message: await this.i18n.t(USER_I18N.PASSWORD_CHANGED),
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
      message: await this.i18n.t(USER_I18N.ROLE_UPDATED),
      timeStamp: new Date().toISOString(),
      data: true,
    };
  }

  @Mutation(() => BooleanResponse)
  @Auth([Permission.EDIT_USER_ROLE])
  async updateUserRole(
    @Args('id') id: string,
    @Args('role', { type: () => Role }) role: Role,
  ): Promise<BooleanResponse> {
    await this.userService.updateUserRole(id, role);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(USER_I18N.ROLE_UPDATED),
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
      message: await this.i18n.t(USER_I18N.STATUS_UPDATED),
      timeStamp: new Date().toISOString(),
      data: true,
    };
  }

  @Query(() => UserStatsResponse)
  @Auth([Permission.VIEW_USER])
  async getUserStats(): Promise<UserStatsResponse> {
    const stats = await this.userService.countUsersThisMonthAndLastMonth();
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(USER_I18N.STATS_RETRIEVED),
      timeStamp: new Date().toISOString(),
      data: stats,
    };
  }

  @Mutation(() => BooleanResponse)
  @Auth([Permission.DELETE_USER])
  async deleteUser(@Args('id') id: string): Promise<BooleanResponse> {
    await this.userService.deleteUser(id);
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(USER_I18N.USER_DELETED),
      timeStamp: new Date().toISOString(),
      data: true,
    };
  }
}
