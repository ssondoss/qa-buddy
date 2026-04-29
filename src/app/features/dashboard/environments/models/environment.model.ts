import type { ApiSuccessResponse } from '../../../auth/models/auth.model';

export interface EnvironmentRequest {
  name: string;
  webBaseUrl: string;
  apiBaseUrl: string;
}

export interface EnvironmentResponse {
  id: string;
  name: string;
  webBaseUrl: string;
  apiBaseUrl: string;
  createdAt: string;
  updatedAt: string;
}

export type EnvironmentListResponse = ApiSuccessResponse<EnvironmentResponse[]>;

export type EnvironmentItemResponse = ApiSuccessResponse<EnvironmentResponse>;

export type EnvironmentDeleteResponse = ApiSuccessResponse<EnvironmentResponse | null>;
