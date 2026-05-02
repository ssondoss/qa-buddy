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

export interface LoginResponseData {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  userId: string;
  email: string;
}

export interface ResendVerificationResponseData {
  verificationEmailSent: boolean;
  message: string;
}

export const AUTH_TOKEN_STORAGE_KEY = 'qaBuddyAuthToken';
