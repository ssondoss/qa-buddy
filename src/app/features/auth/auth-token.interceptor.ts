import { HttpBackend, HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AUTH_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from './models/auth.model';

function clearAuthState(): void {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const backend = inject(HttpBackend);

  const isSpringApiRequest =
    request.url.startsWith(environment.apiHost) || request.url.startsWith('/api/');
  const isAuthRequest =
    request.url.includes('/api/auth/');

  if (!isSpringApiRequest || isAuthRequest) {
    return next(request);
  }

  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const authedRequest = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) {
        return throwError(() => error);
      }

      const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
      if (!refreshToken) {
        clearAuthState();
        void router.navigate(['/login']);
        return throwError(() => error);
      }

      // Use HttpBackend directly to bypass all interceptors (avoids infinite loop)
      const http = new HttpClient(backend);
      return http
        .post<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(
          `${environment.apiHost}/api/auth/refresh`,
          { refreshToken },
        )
        .pipe(
          switchMap((response) => {
            localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.data.accessToken);
            localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, response.data.refreshToken);
            const retried = request.clone({
              setHeaders: { Authorization: `Bearer ${response.data.accessToken}` },
            });
            return next(retried);
          }),
          catchError(() => {
            clearAuthState();
            void router.navigate(['/login']);
            return throwError(() => error);
          }),
        );
    }),
  );
};