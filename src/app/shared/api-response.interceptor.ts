import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, map, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiClientError, type ApiResponse } from './api-response.model';
import { NotificationService } from './notifications/notification.service';

export const apiResponseInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isSpringApiRequest(request.url)) {
    return next(request);
  }

  const notifications = inject(NotificationService);

  return next(request).pipe(
    map((event) => {
      if (event instanceof HttpResponse && isApiResponse(event.body)) {
        const body = event.body;

        if (!body.success) {
          throw new ApiClientError(body.message || 'Request failed', body.status, body.errors, body.timestamp);
        }

        return event.clone({ body: body.data });
      }

      return event;
    }),
    catchError((error: unknown) => {
      const normalizedError = normalizeApiError(error);

      if (!isAuthRequest(request.url)) {
        notifications.error(normalizedError.message || 'Request failed');
      }

      return throwError(() => normalizedError);
    }),
  );
};

function isSpringApiRequest(url: string): boolean {
  return url.startsWith(environment.apiHost) || url.startsWith('/api/');
}

function isAuthRequest(url: string): boolean {
  return url.includes('/api/auth/');
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<ApiResponse<unknown>>;
  return (
    typeof payload.success === 'boolean' &&
    typeof payload.status === 'number' &&
    typeof payload.message === 'string' &&
    'data' in payload &&
    'timestamp' in payload
  );
}

function normalizeApiError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) {
    return error;
  }

  if (!(error instanceof HttpErrorResponse)) {
    return new ApiClientError('Unexpected error', 0);
  }

  const payload = error.error;

  if (payload && typeof payload === 'object') {
    const apiPayload = payload as {
      message?: unknown;
      errors?: unknown;
      timestamp?: unknown;
    };

    return new ApiClientError(
      typeof apiPayload.message === 'string' ? apiPayload.message : error.message,
      error.status,
      isRecord(apiPayload.errors) ? apiPayload.errors : null,
      typeof apiPayload.timestamp === 'string' ? apiPayload.timestamp : null,
    );
  }

  if (typeof payload === 'string' && payload.trim()) {
    return new ApiClientError(payload, error.status);
  }

  return new ApiClientError(error.message || 'Request failed', error.status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
