import { registerEnumType } from '@nestjs/graphql';

export enum Role {
  ADMIN = 'admin',
  USER = 'user',
}
export const AllRoles: Role[] = Object.values(Role);

export enum Permission {
  UPDATE_USER = 'UPDATE_USER',
  DELETE_USER = 'DELETE_USER',
  EDIT_USER_ROLE = 'EDIT_USER_ROLE',
  VIEW_USER = 'VIEW_USER',

  RESET_PASSWORD = 'RESET_PASSWORD',
  CHANGE_PASSWORD = 'CHANGE_PASSWORD',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
  LOGOUT = 'LOGOUT',
}

registerEnumType(Permission, {
  name: 'Permission',
  description: 'Detailed permissions in the system',
});

registerEnumType(Role, {
  name: 'Role',
  description: 'User roles in the system',
});
