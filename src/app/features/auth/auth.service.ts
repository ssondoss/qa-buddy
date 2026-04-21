import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ResendVerificationRequest,
  ResendVerificationResponse,
} from './models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = `${environment.apiHost}/api/auth`;

  constructor(private readonly http: HttpClient) {}

  register(payload: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.base}/register`, payload);
  }

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/login`, payload);
  }

  resendVerification(payload: ResendVerificationRequest): Observable<ResendVerificationResponse> {
    return this.http.post<ResendVerificationResponse>(`${this.base}/resend-verification`, payload);
  }
}
