export type WorkflowVersionStatus = 'DRAFT' | 'RECORDING' | 'READY' | 'FAILED';

export interface WorkflowUpsertRequest {
  name: string;
  description?: string;
}

export interface WorkflowRecordingStartRequest {
  environmentId: string;
  startPath?: string;
}

export interface WorkflowResponse {
  id: string;
  name: string;
  description: string;
  versionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VersionView {
  workflowId: string;
  versionId: string;
  versionNumber: number;
  status: WorkflowVersionStatus;
  environmentNameSnapshot: string | null;
  environmentWebBaseUrlSnapshot: string | null;
  environmentApiBaseUrlSnapshot: string | null;
  createdAt: string;
  updatedAt: string;
}
