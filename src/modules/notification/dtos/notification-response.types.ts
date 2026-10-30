import { ObjectType } from '@nestjs/graphql';
import { GeneralResponse } from '../../../common/graphql/general-response.type.js';
import {
  NotificationLogType,
  NotificationDispatchPayload,
  DeadLetterJobDiagnosticsType,
  DeadLetterStatsType,
  NotificationPreferenceStatusType,
} from './notification.types.js';

@ObjectType()
export class NotificationDispatchResponse extends GeneralResponse(
  NotificationDispatchPayload,
) {}

@ObjectType()
export class NotificationLogResponse extends GeneralResponse(
  NotificationLogType,
) {}

@ObjectType()
export class DeadLetterStatsResponse extends GeneralResponse(
  DeadLetterStatsType,
) {}

@ObjectType()
export class DeadLetterDiagnosticsResponse extends GeneralResponse(
  DeadLetterJobDiagnosticsType,
) {}

@ObjectType()
export class NotificationPreferenceResponse extends GeneralResponse(
  NotificationPreferenceStatusType,
) {}
