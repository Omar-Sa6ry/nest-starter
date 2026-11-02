import { Module } from '@nestjs/common';
import { UserService } from './user.service.js';
import { DbUserService } from './db-user.service.js';
import { UserResolver } from './user.resolver.js';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entity/user.entity.js';
import { MediaModule } from '../media/media.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    MediaModule,
  ],
  providers: [
    DbUserService,
    UserService,
    UserResolver,
    {
      provide: 'USER_REPOSITORY',
      useExisting: getRepositoryToken(User),
    },
  ],
  exports: [UserService, TypeOrmModule, 'USER_REPOSITORY'],
})
export class UserModule {}
