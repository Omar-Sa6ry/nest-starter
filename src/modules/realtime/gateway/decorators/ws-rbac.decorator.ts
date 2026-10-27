import { SetMetadata } from '@nestjs/common';
import { Permission, Role } from '../../../../common/constant/enum.constant.js';

export const WS_ROLES_KEY = 'roles';
export const WS_PERMISSIONS_KEY = 'permissions';

export const WsRoles = (...roles: Role[]) => SetMetadata(WS_ROLES_KEY, roles);
export const WsPermissions = (...permissions: Permission[]) => SetMetadata(WS_PERMISSIONS_KEY, permissions);
