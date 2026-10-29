import { randomUUID } from 'node:crypto';
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import type {
  IPasswordHasher,
  ITokenProvider,
  ISessionStore,
} from '../../../common/interfaces/ISecurity.interface.js';
import { User } from '../../user/entity/user.entity.js';
import { UserFactory } from '../factory/user.factory.js';
import { Role } from '../../../common/constant/enum.constant.js';
import { rolePermissionsMap } from '../../../common/constant/rolePermissionsMap.constant.js';
import { I18nService } from 'nestjs-i18n';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StructuredLogger } from '../../../common/logging/logger.service.js';
import { hashToken } from '../utils/hashToken.util.js';
import { UserRegisteredEvent } from '../events/domain.events.js';
import type {
  IAuthCommand,
  RegisterCommandInput,
  AuthResult,
} from '../interfaces/IAuthCommands.interface.js';
import { AUTH_I18N } from '../constants/auth-i18n.constants.js';

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 3600;

@Injectable()
export class RegisterCommand implements IAuthCommand<
  RegisterCommandInput,
  AuthResult
> {
  constructor(
    private readonly userFactory: UserFactory,
    @Inject('PASSWORD_HASHER') private readonly passwordHasher: IPasswordHasher,
    @Inject('TOKEN_PROVIDER') private readonly tokenProvider: ITokenProvider,
    @Inject('SESSION_STORE') private readonly sessionStore: ISessionStore,
    private readonly dataSource: DataSource,
    private readonly i18n: I18nService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: StructuredLogger,
  ) {}

  async execute(input: RegisterCommandInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const { password, firstName, lastName, phoneNumber, imageUrl } = input;

    const hashedPassword = await this.passwordHasher.hash(password);

    const savedUser = await this.dataSource.transaction(async (em) => {
      const userRepo = em.getRepository(User);

      await this.checkIfValid(phoneNumber, email, userRepo);
      const totalUsers = await userRepo.count();
      const role = totalUsers === 0 ? Role.ADMIN : Role.USER;

      const user = this.userFactory.createUser(
        email,
        hashedPassword,
        firstName,
        lastName,
        role,
        phoneNumber,
        imageUrl,
      );

      return userRepo.save(user);
    });

    const tokens = await this.createSession(savedUser);

    this.eventEmitter.emit(
      'user.registered',
      new UserRegisteredEvent(
        savedUser.id,
        savedUser.email,
        savedUser.firstName,
        savedUser.role,
      ),
    );

    this.logger.log(
      `User registered: ${savedUser.email} (${savedUser.role})`,
      'RegisterCommand',
    );

    return { user: savedUser, ...tokens };
  }

  private async checkIfValid(
    phoneNumber: string | undefined,
    email: string,
    userRepo: Repository<User>,
  ): Promise<void> {
    const [existingPhone, existingEmail] = await Promise.all([
      phoneNumber
        ? userRepo.findOne({ where: { phoneNumber } })
        : Promise.resolve(null),
      userRepo.findOne({ where: { email } }),
    ]);

    if (existingEmail)
      throw new BadRequestException(this.i18n.t(AUTH_I18N.EMAIL_EXISTED));
    if (existingPhone)
      throw new BadRequestException(this.i18n.t(AUTH_I18N.PHONE_EXISTED));
  }

  private async createSession(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const sessionId = randomUUID();
    const permissions = rolePermissionsMap[user.role] || [];

    const tokens = await this.tokenProvider.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions,
      sessionId,
    });

    await this.sessionStore.createSession(
      user.id,
      sessionId,
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId,
        createdAt: new Date(),
      },
      tokens.expiresIn,
    );

    await this.sessionStore.storeRefreshToken(
      hashToken(tokens.refreshToken),
      user.id,
      REFRESH_TOKEN_TTL_SECONDS,
    );

    return tokens;
  }
}
