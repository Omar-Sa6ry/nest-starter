import type { GraphQLFormattedError } from 'graphql';

/**
 * The **only** fields a GraphQL error is allowed to expose:
 *
 * ```json
 * {
 *   "message": "User not found",
 *   "success": false,
 *   "statusCode": 404,
 *   "timestamp": "2026-10-25T10:15:30.123Z"
 * }
 * ```
 *
 * Wired up as Apollo's `formatError` in `common.module.ts`, so it runs for
 * **every** error in the response — resolver errors normalized by
 * `GraphQLExceptionFilter`, Apollo's own parse/validation errors and errors
 * raised on the HTTP layer. `locations`, `path`, `extensions` and
 * `stacktrace` are deliberately dropped; the status/timestamp that the filter
 * parked in `extensions` are promoted to top-level fields.
 */
export interface IFlatGraphQLError {
  message: string;
  success: false;
  statusCode: number;
  timestamp: string;
}

/** `extensions.code` → HTTP status for errors that never reached the filter. */
const CODE_TO_STATUS: Record<string, number> = {
  GRAPHQL_PARSE_FAILED: 400,
  GRAPHQL_VALIDATION_FAILED: 400,
  PERSISTED_QUERY_NOT_FOUND: 400,
  PERSISTED_QUERY_NOT_SUPPORTED: 400,
  BAD_REQUEST: 400,
  BAD_USER_INPUT: 400,
  OPERATION_RESOLUTION_FAILURE: 400,
  MAX_RECURSIVE_SELECTIONS_EXCEEDED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INTROSPECTION_DISABLED: 403,
  NOT_FOUND: 404,
  METHOD_NOT_SUPPORTED: 405,
  TIMEOUT: 504,
  INTERNAL_SERVER_ERROR: 500,
};

export function formatGraphQLError(
  error: GraphQLFormattedError,
): IFlatGraphQLError {
  const extensions = (error.extensions ?? {}) as Record<string, unknown>;

  return {
    message: toFlatMessage(error.message),
    success: false,
    statusCode: resolveStatusCode(extensions),
    timestamp: resolveTimestamp(extensions),
  };
}

function resolveStatusCode(extensions: Record<string, unknown>): number {
  // 1. GraphQLExceptionFilter / HttpException
  const direct = pickStatus(extensions.statusCode) ?? pickStatus(extensions.status);
  if (direct) return direct;

  // 2. Apollo's HTTP layer errors carry `extensions.http.status`
  const http = extensions.http as { status?: unknown } | undefined;
  const fromHttp = pickStatus(http?.status);
  if (fromHttp) return fromHttp;

  // 3. Apollo error codes (parse/validation/bad input/…)
  const code = typeof extensions.code === 'string' ? extensions.code : undefined;
  const mapped = code ? CODE_TO_STATUS[code] : undefined;
  if (mapped) return mapped;

  return 500;
}

function resolveTimestamp(extensions: Record<string, unknown>): string {
  const value = extensions.timestamp ?? extensions.timeStamp;
  return typeof value === 'string' ? value : new Date().toISOString();
}

function pickStatus(value: unknown): number | undefined {
  const status = typeof value === 'string' ? Number(value) : value;
  return typeof status === 'number' && Number.isInteger(status) && status > 0
    ? status
    : undefined;
}

/** `message` is a string per the spec, but be defensive and merge arrays. */
function toFlatMessage(message: unknown): string {
  if (Array.isArray(message)) {
    const merged = message.filter(Boolean).map(String).join(', ');
    return merged || 'An unexpected error occurred';
  }
  return typeof message === 'string' && message
    ? message
    : 'An unexpected error occurred';
}
