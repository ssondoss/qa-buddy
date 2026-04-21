export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  status: number;
  message: string;
  data: T;
  errors: null;
  timestamp: string;
}

export interface LoginResponseData {
  token: string;
}

export interface ResendVerificationResponseData {
  verificationEmailSent: boolean;
  message: string;
}

export type RegisterResponse = ApiSuccessResponse<unknown>;

export type LoginResponse = ApiSuccessResponse<LoginResponseData>;

export type ResendVerificationResponse = ApiSuccessResponse<ResendVerificationResponseData>;

export interface ApiErrorResponse {
  success: false;
  status: number;
  message: string;
  errors: Record<string, unknown>;
  timestamp: string;
}

export const AUTH_TOKEN_STORAGE_KEY = 'qaBuddyAuthToken';
