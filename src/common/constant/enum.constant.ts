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

  // Notification
  NOTIFICATION_SEND = 'NOTIFICATION_SEND',
  NOTIFICATION_MANAGE = 'NOTIFICATION_MANAGE',
  NOTIFICATION_VIEW = 'NOTIFICATION_VIEW',

  // Payment
  PAYMENT_INITIATE = 'PAYMENT_INITIATE',
  PAYMENT_VIEW = 'PAYMENT_VIEW',
  PAYMENT_MANAGE = 'PAYMENT_MANAGE',

  // Media
  MEDIA_UPLOAD = 'MEDIA_UPLOAD',
  MEDIA_VIEW = 'MEDIA_VIEW',
  MEDIA_DELETE = 'MEDIA_DELETE',
  MEDIA_ADMIN = 'MEDIA_ADMIN',
}

registerEnumType(Permission, {
  name: 'Permission',
  description: 'Detailed permissions in the system',
});

registerEnumType(Role, {
  name: 'Role',
  description: 'User roles in the system',
});
