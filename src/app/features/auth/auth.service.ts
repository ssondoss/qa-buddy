import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  LoginResponseData,
  LoginRequest,
  RegisterRequest,
  ResendVerificationRequest,
  ResendVerificationResponseData,
} from './models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = `${environment.apiHost}/api/auth`;

  constructor(private readonly http: HttpClient) {}

  register(payload: RegisterRequest): Observable<unknown> {
    return this.http.post<unknown>(`${this.base}/register`, payload);
  }

  login(payload: LoginRequest): Observable<LoginResponseData> {
    return this.http.post<LoginResponseData>(`${this.base}/login`, payload);
  }

  resendVerification(payload: ResendVerificationRequest): Observable<ResendVerificationResponseData> {
    return this.http.post<ResendVerificationResponseData>(`${this.base}/resend-verification`, payload);
  }
}
