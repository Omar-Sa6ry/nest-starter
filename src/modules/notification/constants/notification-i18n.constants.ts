export const NOTIFICATION_I18N = {
  SENT_SUCCESS: 'notification.SENT_SUCCESS',
  QUEUED_SUCCESS: 'notification.QUEUED_SUCCESS',
  PREFERENCES_UPDATED: 'notification.PREFERENCES_UPDATED',
  PREFERENCES_FETCHED: 'notification.PREFERENCES_FETCHED',
  STATS_FETCHED: 'notification.STATS_FETCHED',
  FAILED_JOBS_FETCHED: 'notification.FAILED_JOBS_FETCHED',
  JOB_REPLAYED: 'notification.JOB_REPLAYED',
  JOBS_PURGED: 'notification.JOBS_PURGED',
  NOT_FOUND: 'notification.NOT_FOUND',
  FAILED_TO_SEND: 'notification.FAILED_TO_SEND',
  RECIPIENT_OPTOUT: 'notification.RECIPIENT_OPTOUT',
} as const;

export type NotificationI18nKey =
  (typeof NOTIFICATION_I18N)[keyof typeof NOTIFICATION_I18N];
