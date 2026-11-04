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
    Permission.NOTIFICATION_VIEW,

    // Payment
    Permission.PAYMENT_INITIATE,
    Permission.PAYMENT_VIEW,
    Permission.PAYMENT_MANAGE,

    // Media
    Permission.MEDIA_UPLOAD,
    Permission.MEDIA_VIEW,
    Permission.MEDIA_DELETE,
    Permission.MEDIA_ADMIN,
  ],

  [Role.USER]: [
    Permission.UPDATE_USER,
    Permission.RESET_PASSWORD,
    Permission.CHANGE_PASSWORD,
    Permission.FORGOT_PASSWORD,
    Permission.LOGOUT,

    // Notification
    Permission.NOTIFICATION_VIEW,

    // Payment
    Permission.PAYMENT_INITIATE,
    Permission.PAYMENT_VIEW,

    // Media
    Permission.MEDIA_UPLOAD,
    Permission.MEDIA_VIEW,
    Permission.MEDIA_DELETE,
  ],
};
