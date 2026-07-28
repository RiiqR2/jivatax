export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  message: string;
  code?: string;
  statusCode?: number;
  errors?: ApiFieldError[];
}

export type ApiResult<T> =
  { data: T; error?: never } | { data?: never; error: ApiErrorResponse };
