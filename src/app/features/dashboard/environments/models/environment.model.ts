export interface EnvironmentRequest {
  name: string;
  description: string | null;
  webBaseUrl: string;
  apiBaseUrl: string | null;
}

export interface EnvironmentResponse {
  id: string;
  name: string;
  description: string | null;
  webBaseUrl: string;
  apiBaseUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
