import { Resolver, Query } from '@nestjs/graphql';
import { I18nService } from 'nestjs-i18n';
import { BooleanResponse } from './common/graphql/general-response.type.js';

@Resolver()
export class AppResolver {
  constructor(private readonly i18n: I18nService) {}

  @Query(() => BooleanResponse)
  async pingApp(): Promise<BooleanResponse> {
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t('common.APP_RUNNING'),
      timeStamp: new Date().toISOString(),
      data: true,
    };
  }
}
