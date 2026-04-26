import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AUTH_TOKEN_STORAGE_KEY } from './models/auth.model';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const isSpringApiRequest =
    request.url.startsWith(environment.apiHost) || request.url.startsWith('/api/');

  if (!isSpringApiRequest) {
    return next(request);
  }

  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

  if (!token) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};
