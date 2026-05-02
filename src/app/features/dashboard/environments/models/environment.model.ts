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
