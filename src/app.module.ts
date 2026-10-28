import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { CommonModule } from './common/common.module.js';
import { LoggingModule } from './common/logging/logger.module.js';
import { MetricsModule } from './common/metrics/metrics.module.js';
import { AutomationModule } from './common/automation/automation.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UserModule } from './modules/user/user.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { GraphQLExceptionFilter } from './common/filters/graphql-exception.filter.js';
import { GraphQLResponseInterceptor } from './common/interceptors/graphql-response.interceptor.js';
import { AppResolver } from './app.resolver.js';
import { MetricsInterceptor } from './common/metrics/interceptor/metrics.interceptor.js';

// import { createObserveModule } from '@nestjs/observe';
// export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // ObserveModule.forRoot({
    //   appKey: 'YOUR_APP_KEY',
    //   appSecret: 'YOUR_APP_SECRET',
    //   serviceId: 'my-project',
    // }),

    LoggingModule,
    MetricsModule,
    AutomationModule,

    CommonModule,
    AuthModule,
    UserModule,
    RealtimeModule,
  ],
  providers: [
    AppResolver,
    {
      provide: APP_FILTER,
      useClass: GraphQLExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: GraphQLResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
