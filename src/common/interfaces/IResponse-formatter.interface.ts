export interface IFormattedSuccessEnvelope<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  timeStamp: string;
  data: T;
  items?: unknown[];
  paginationInfo?: unknown;
}

/**
 * Error envelope shared by REST and GraphQL errors.
 *
 * Deliberately minimal — the API contract is exactly these four fields:
 *   { success, statusCode, message, timestamp }
 * (the GraphQL variant is produced by `formatGraphQLError`, which flattens
 * `extensions` into the error object and drops locations/path/stacktrace).
 */
export interface IFormattedErrorEnvelope {
  success: boolean;
  statusCode: number;
  message: string;
  timestamp: string;
}

export interface IRawDataWithMeta {
  items?: unknown[];
  data?: { items?: unknown[] };
  success?: boolean;
  statusCode?: number;
  message?: string;
  paginationInfo?: unknown;
  pagination?: unknown;
}

export interface IErrorWithMeta {
  errors?: Array<{ message?: string }>;
  response?: {
    message?: string | string[];
    statusCode?: number;
    error?: string;
  };
  message?: string;
  status?: number;
  statusCode?: number;
}
