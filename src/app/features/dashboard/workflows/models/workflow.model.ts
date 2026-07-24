export type WorkflowVersionStatus = 'DRAFT' | 'RECORDING' | 'READY' | 'FAILED';

export interface WorkflowUpsertRequest {
  name: string;
  description?: string;
}

export interface WorkflowRecordingStartRequest {
  environmentId: string;
  startPath?: string;
  alias?: string;
}

export interface RecordingStartResponse {
  versionId: string;
  workflow: WorkflowResponse;
}

export interface WorkflowResponse {
  id: string;
  name: string;
  description: string;
  versionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDeletePreview {
  versionsCount: number;
  stepsCount: number;
  executionsCount: number;
  discoveredApisCount: number;
}

export interface VersionView {
  workflowId: string;
  versionId: string;
  versionNumber: number;
  status: WorkflowVersionStatus;
  alias: string | null;
  environmentNameSnapshot: string | null;
  environmentWebBaseUrlSnapshot: string | null;
  environmentApiBaseUrlSnapshot: string | null;
  createdAt: string;
  updatedAt: string;
  executionsCount: number;
}

export interface VersionAliasUpdateRequest {
  alias: string | null;
}
