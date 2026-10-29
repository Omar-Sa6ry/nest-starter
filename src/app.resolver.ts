import { Resolver, Query } from '@nestjs/graphql';
import { I18nService } from 'nestjs-i18n';
import { BooleanResponse } from './common/graphql/general-response.type.js';
import { COMMON_I18N } from './common/constant/common-i18n.constants.js';

@Resolver()
export class AppResolver {
  constructor(private readonly i18n: I18nService) {}

  @Query(() => BooleanResponse)
  async pingApp(): Promise<BooleanResponse> {
    return {
      success: true,
      statusCode: 200,
      message: await this.i18n.t(COMMON_I18N.APP_RUNNING),
      timeStamp: new Date().toISOString(),
      data: true,
    };
  }
}
