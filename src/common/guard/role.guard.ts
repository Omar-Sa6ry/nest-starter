import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { I18nService } from 'nestjs-i18n';
import { Request } from 'express';
import { rolePermissionsMap } from '../constant/rolePermissionsMap.constant.js';
import { Permission, Role } from '../constant/enum.constant.js';
import { IAuthenticatedRequest } from '../interfaces/IContext.interface.js';
import { IJwtPayload } from '../interfaces/IJwtPayload.interface.js';
import type {
  ITokenProvider,
  ISessionStore,
} from '../interfaces/ISecurity.interface.js';
import {
  TOKEN_PROVIDER,
  SESSION_STORE,
} from '../security/tokens/injection.tokens.js';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private readonly i18n: I18nService,
    @Inject(TOKEN_PROVIDER)
    private readonly tokenProvider: ITokenProvider,
    @Inject(SESSION_STORE)
    private readonly sessionStore: ISessionStore,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let request: IAuthenticatedRequest;
    if (context.getType<string>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      request = ctx.getContext<{ req: IAuthenticatedRequest }>().req;
    } else {
      request = context.switchToHttp().getRequest<IAuthenticatedRequest>();
    }

    const token = this.extractTokenFromHeader(request);

    if (!token)
      throw new UnauthorizedException(await this.i18n.t('user.NO_TOKEN'));

    const jti = await this.tokenProvider.getJti(token);
    if (jti && (await this.sessionStore.isTokenBlacklisted(jti)))
      throw new UnauthorizedException(await this.i18n.t('user.INVALID_TOKEN'));

    const requiredRoles = this.getRequiredRoles(context);
    const requiredPermissions = this.getRequiredPermissions(context);

    const payload = await this.verifyToken(token);

    if (!payload.userId)
      throw new UnauthorizedException(await this.i18n.t('user.INVALID_TOKEN'));

    const userRole = payload.role as Role;
    const userPermissions = rolePermissionsMap[userRole] ?? [];

    const hasRole = this.validateRole(userRole, requiredRoles);
    const hasPermissions = this.validatePermissions(
      userPermissions,
      requiredPermissions,
    );

    if (!hasRole || !hasPermissions) {
      throw new ForbiddenException(
        await this.i18n.t('user.INSUFFICIENT_PERMISSIONS'),
      );
    }

    request.user = {
      id: payload.userId,
      email: payload.email || '',
      role: userRole,
      permissions: userPermissions,
      sessionId: payload.sessionId,
    };

    return true;
  }

  private extractTokenFromHeader(request: Request): string | null {
    if (!request || !request.headers) return null;
    const [type, token] = request.headers['authorization']?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }

  private async verifyToken(token: string): Promise<IJwtPayload> {
    const payload = await this.tokenProvider.verifyAccessToken(token);
    if (!payload) {
      throw new UnauthorizedException(await this.i18n.t('user.INVALID_TOKEN'));
    }
    return payload as IJwtPayload;
  }

  private getRequiredRoles(context: ExecutionContext): Role[] {
    return (
      this.reflector.getAllAndOverride<Role[]>('roles', [
        context.getHandler(),
        context.getClass(),
      ]) ?? []
    );
  }

  private getRequiredPermissions(context: ExecutionContext): Permission[] {
    return (
      this.reflector.getAllAndOverride<Permission[]>('permissions', [
        context.getHandler(),
        context.getClass(),
      ]) ?? []
    );
  }

  private validateRole(userRole: Role, requiredRoles: Role[]): boolean {
    return requiredRoles.length === 0 || requiredRoles.includes(userRole);
  }

  private validatePermissions(
    userPermissions: Permission[],
    required: Permission[],
  ): boolean {
    return required.every((p) => userPermissions.includes(p));
  }
}
