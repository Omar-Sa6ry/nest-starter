import { Injectable, Inject } from '@nestjs/common';
import type {
  ITokenProvider,
  ISessionStore,
} from '../../../common/interfaces/ISecurity.interface.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StructuredLogger } from '../../../common/logging/logger.service.js';
import { UserLoggedOutEvent } from '../events/domain.events.js';
import type {
  IAuthCommand,
  LogoutCommandInput,
} from '../interfaces/IAuthCommands.interface.js';

@Injectable()
export class LogoutCommand implements IAuthCommand<LogoutCommandInput, void> {
  constructor(
    @Inject('TOKEN_PROVIDER') private readonly tokenProvider: ITokenProvider,
    @Inject('SESSION_STORE') private readonly sessionStore: ISessionStore,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: StructuredLogger,
  ) {}

  async execute(input: LogoutCommandInput): Promise<void> {
    await this.sessionStore.revokeSession(input.userId, input.sessionId);

    if (input.accessToken) {
      const jti = await this.tokenProvider.getJti(input.accessToken);
      if (jti) {
        await this.sessionStore.blacklistToken(jti, 3600 * 24);
      }
    }

    this.eventEmitter.emit(
      'user.logged_out',
      new UserLoggedOutEvent(input.userId, input.sessionId),
    );

    this.logger.log(`User logged out: ${input.userId}`, 'LogoutCommand');
  }
}