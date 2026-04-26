import type { ApiSuccessResponse } from '../../auth/models/auth.model';

export interface WorkflowRequest {
  name: string;
  description?: string;
}

export interface WorkflowResponse {
  id?: number | string;
  name: string;
  description?: string | null;
  owner?: string | null;
  environment?: string | null;
  status?: string | null;
  stepCount?: number | null;
  lastRun?: string | null;
  schedule?: string | null;
}

export type CreateWorkflowResponse = ApiSuccessResponse<WorkflowResponse>;
