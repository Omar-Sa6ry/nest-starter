export interface IFormattedSuccessEnvelope<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  timeStamp: string;
  data: T;
  items?: unknown[];
  paginationInfo?: unknown;
}

export interface IFormattedErrorEnvelope {
  success: boolean;
  statusCode: number;
  message: string;
  timeStamp: string;
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
