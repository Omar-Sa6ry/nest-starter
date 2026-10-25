import {
  IErrorWithMeta,
  IFormattedErrorEnvelope,
  IFormattedSuccessEnvelope,
  IRawDataWithMeta,
} from '../interfaces/IResponse-formatter.interface.js';

export class ResponseFormatter {
  static formatSuccess<T = unknown>(
    data: T,
    fallbackMessage: string = 'Operation executed successfully',
  ): IFormattedSuccessEnvelope<T> {
    const isArray = Array.isArray(data);
    const raw = data as unknown as IRawDataWithMeta | undefined;
    const isEnvelope =
      raw &&
      typeof raw === 'object' &&
      !isArray &&
      'success' in raw &&
      'statusCode' in raw;

    let items: unknown[] = [];
    if (Array.isArray(raw?.items)) {
      items = raw.items;
    } else if (Array.isArray(raw?.data?.items)) {
      items = raw.data.items;
    } else if (isArray) {
      items = data as unknown as unknown[];
    }

    return {
      success: true,
      statusCode: isEnvelope ? (raw.statusCode ?? 200) : 200,
      message: isEnvelope
        ? (raw.message ?? fallbackMessage)
        : raw?.message || fallbackMessage,
      timeStamp: new Date().toISOString(),
      data: isEnvelope
        ? (raw.data as T)
        : raw?.data !== undefined
          ? (raw.data as T)
          : (data ?? (null as unknown as T)),
      items: items.length > 0 ? items : undefined,
      paginationInfo: raw?.paginationInfo || raw?.pagination,
    };
  }

  static formatError(
    error: unknown,
    fallbackMessage: string = 'An unexpected error occurred',
  ): IFormattedErrorEnvelope {
    const err = error as IErrorWithMeta | undefined;

    const message =
      ResponseFormatter.joinMessages([
        err?.errors?.map((e) => e?.message),
        err?.response?.message,
        err?.message,
      ]) || fallbackMessage;

    const statusCode =
      err?.response?.statusCode || err?.status || err?.statusCode || 500;

    return {
      success: false,
      statusCode,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Collapses every candidate message (string or array — e.g. class-validator
   * field errors) into a single line: "name is required, email is invalid".
   */
  private static joinMessages(
    candidates: Array<unknown>,
    fallbackMessage?: string,
  ): string {
    for (const candidate of candidates) {
      const list = Array.isArray(candidate)
        ? candidate.filter(Boolean).map(String)
        : candidate
          ? [String(candidate)]
          : [];

      // Sources are alternatives (errors[] | response.message | message):
      // the first one that yields text wins, its entries merged into one line.
      if (list.length > 0) return list.join(', ');
    }

    return fallbackMessage ?? '';
  }
}
