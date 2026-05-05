export type ExecutionStatus = 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELED' | 'TIMED_OUT';
export type ExecutionStepStatus = 'PASSED' | 'FAILED' | 'SKIPPED';

export interface ExecutionStepResultView {
  stepId: string;
  orderIndex: number;
  status: ExecutionStepStatus;
  errorMessage: string | null;
  screenshotUrl: string | null;
  log: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  stepSnapshot: Record<string, unknown>;
}

export interface ExecutionView {
  id: string;
  workflowId: string;
  versionId: string;
  versionNumber: number;
  status: ExecutionStatus;
  triggeredById: string;
  environmentNameSnapshot: string | null;
  environmentWebBaseUrlSnapshot: string | null;
  environmentApiBaseUrlSnapshot: string | null;
  startedAt: string;
  finishedAt: string | null;
  stepResults: ExecutionStepResultView[];
}