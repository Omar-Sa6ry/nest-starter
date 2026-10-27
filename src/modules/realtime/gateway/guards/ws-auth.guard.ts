import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { I18nService } from 'nestjs-i18n';
import { WS_DEFAULT_LANG } from '../../constants/realtime.constants.js';
import { WS_I18N } from '../../constants/realtime-i18n.constants.js';
import type { I18nTranslate } from '../../types/i18n.types.js';
import type { AuthenticatedSocket } from '../../types/realtime.types.js';
import { wsError } from '../../utils/ws-errors.util.js';
import { Role, Permission } from '../../../../common/constant/enum.constant.js';
import { rolePermissionsMap } from '../../../../common/constant/rolePermissionsMap.constant.js';
import type { ISessionStore } from '../../../../common/interfaces/ISecurity.interface.js';
import { SESSION_STORE } from '../../../../common/security/tokens/injection.tokens.js';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    @Inject(I18nService) private readonly i18n: I18nTranslate,
    private readonly reflector: Reflector,
    @Inject(SESSION_STORE) private readonly sessionStore: ISessionStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'ws') {
      return true;
    }
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    const user = client.data?.user;
    const lang = client.data?.lang ?? WS_DEFAULT_LANG;

    if (!user) {
      throw wsError(
        'UNAUTHORIZED',
        this.i18n.t(WS_I18N.UNAUTHORIZED, { lang }) as string,
        401,
      );
    }

    // Verify session is still valid (not logged out or revoked)
    if (user.sessionId) {
      const isBlacklisted = await this.sessionStore.isTokenBlacklisted(user.sessionId);
      if (isBlacklisted) {
        throw wsError(
          'UNAUTHORIZED',
          this.i18n.t(WS_I18N.UNAUTHORIZED, { lang }) as string,
          401,
        );
      }
    }

    const requiredRoles = this.getRequiredRoles(context);
    const requiredPermissions = this.getRequiredPermissions(context);

    if (requiredRoles.length === 0 && requiredPermissions.length === 0) {
      return true;
    }

    const userRole = user.role as Role;
    const userPermissions = (user.permissions && user.permissions.length > 0)
      ? (user.permissions as Permission[])
      : (rolePermissionsMap[userRole] ?? []);

    const hasRole = this.validateRole(userRole, requiredRoles);
    const hasPermissions = this.validatePermissions(userPermissions, requiredPermissions);

    if (!hasRole || !hasPermissions) {
      throw wsError(
        'FORBIDDEN',
        this.i18n.t(WS_I18N.INSUFFICIENT_PERMISSIONS, { lang }) as string,
        403,
      );
    }

    return true;
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
