export const NOTIFICATION_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  DEFAULT_MAX_ATTEMPTS: 5,
  CIRCUIT_BREAKER_PREFIX: 'cb:notification:',
  DLQ_QUEUE_PREFIX: 'dlq:notification:',
} as const;
