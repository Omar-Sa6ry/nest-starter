import { Permission, Role } from './enum.constant.js';

export const rolePermissionsMap: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    Permission.UPDATE_USER,
    Permission.DELETE_USER,
    Permission.EDIT_USER_ROLE,
    Permission.RESET_PASSWORD,
    Permission.CHANGE_PASSWORD,
    Permission.FORGOT_PASSWORD,
    Permission.LOGOUT,
    Permission.VIEW_USER,

    // Notification
    Permission.NOTIFICATION_SEND,
    Permission.NOTIFICATION_MANAGE,

    // Payment
    Permission.PAYMENT_INITIATE,
    Permission.PAYMENT_VIEW,
    Permission.PAYMENT_MANAGE,
  ],

  [Role.USER]: [
    Permission.UPDATE_USER,
    Permission.RESET_PASSWORD,
    Permission.CHANGE_PASSWORD,
    Permission.FORGOT_PASSWORD,
    Permission.LOGOUT,

    // Payment
    Permission.PAYMENT_INITIATE,
    Permission.PAYMENT_VIEW,
  ],
};
