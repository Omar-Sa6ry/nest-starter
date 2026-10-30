import { registerEnumType } from '@nestjs/graphql';
import {
  ChannelType,
  NotificationPriority,
  NotificationStatus,
  NotificationCategory,
} from '@bts-soft/core';

registerEnumType(ChannelType, {
  name: 'NotificationChannelType',
  description: 'Available notification dispatch channels',
});

registerEnumType(NotificationPriority, {
  name: 'NotificationPriority',
  description: 'Priority levels for notifications',
});

registerEnumType(NotificationStatus, {
  name: 'NotificationDeliveryStatus',
  description: 'Lifecycle statuses for notifications',
});

registerEnumType(NotificationCategory, {
  name: 'NotificationCategory',
  description: 'Category for notifications (e.g. transactional, marketing)',
});
