export interface ApiResponse<T> {
  success: boolean;
  status: number;
  message: string;
  data: T;
  errors: Record<string, unknown> | null;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: Record<string, unknown> | null = null,
    readonly timestamp: string | null = null,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}
