import { Module } from '@nestjs/common';
import { UserService } from './user.service.js';
import { DbUserService } from './db-user.service.js';
import { UserResolver } from './user.resolver.js';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entity/user.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
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
