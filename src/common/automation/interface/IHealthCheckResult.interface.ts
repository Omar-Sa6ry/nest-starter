export type StatusHealthCheckResult = 'UP' | 'DOWN' | 'UNKNOWN';

export interface IHealthCheckResult {
  status: StatusHealthCheckResult;
  message?: string;
}
