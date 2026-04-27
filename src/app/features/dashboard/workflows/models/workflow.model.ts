import type { ApiSuccessResponse } from '../../../auth/models/auth.model';

export interface WorkflowRequest {
  name: string;
  description?: string;
}

export interface WorkflowResponse {
  workflowId: string;
  workflowVersionId: string;
  versionNumber: number;
  stepCount: number;
  versionStatus: string;
}

export type CreateWorkflowResponse = ApiSuccessResponse<WorkflowResponse>;

export type StartRecordingResponse = ApiSuccessResponse<WorkflowResponse>;
