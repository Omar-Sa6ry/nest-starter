import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  NotificationModule as CoreNotificationModule,
  NOTIFICATION_LOG_REPOSITORY,
  NOTIFICATION_OUTBOX_REPOSITORY,
} from '@bts-soft/core';

// GQL Enums registration
import './dtos/notification-enums.gql.js';

// Entities
import { NotificationLogEntity } from './entities/notification-log.entity.js';
import { NotificationOutboxEntity } from './entities/notification-outbox.entity.js';

// Repositories
import { TypeOrmNotificationLogRepository } from './repositories/typeorm-notification-log.repository.js';
import { TypeOrmNotificationOutboxRepository } from './repositories/typeorm-notification-outbox.repository.js';

// Factories and Services
import { NotificationMessageFactory } from './factory/notification-message.factory.js';
import { NotificationService } from './notification.service.js';
import { NotificationResolver } from './notification.resolver.js';
import { NotificationDomainListener } from './events/listeners/notification-domain.listener.js';
import { UserModule } from '../user/user.module.js';

@Module({
  imports: [
    UserModule,
    TypeOrmModule.forFeature([NotificationLogEntity, NotificationOutboxEntity]),
    CoreNotificationModule.register({
      imports: [
        TypeOrmModule.forFeature([
          NotificationLogEntity,
          NotificationOutboxEntity,
        ]),
      ],
      providers: [
        TypeOrmNotificationLogRepository,
        TypeOrmNotificationOutboxRepository,
        {
          provide: NOTIFICATION_LOG_REPOSITORY,
          useExisting: TypeOrmNotificationLogRepository,
        },
        {
          provide: NOTIFICATION_OUTBOX_REPOSITORY,
          useExisting: TypeOrmNotificationOutboxRepository,
        },
      ],
      exports: [NOTIFICATION_LOG_REPOSITORY, NOTIFICATION_OUTBOX_REPOSITORY],
    }),
  ],
  providers: [
    TypeOrmNotificationLogRepository,
    TypeOrmNotificationOutboxRepository,
    {
      provide: NOTIFICATION_LOG_REPOSITORY,
      useExisting: TypeOrmNotificationLogRepository,
    },
    {
      provide: NOTIFICATION_OUTBOX_REPOSITORY,
      useExisting: TypeOrmNotificationOutboxRepository,
    },
    NotificationMessageFactory,
    NotificationService,
    NotificationResolver,
    NotificationDomainListener,
  ],
  exports: [
    NotificationService,
    NotificationMessageFactory,
    NOTIFICATION_LOG_REPOSITORY,
    NOTIFICATION_OUTBOX_REPOSITORY,
  ],
})
export class NotificationModule {}
