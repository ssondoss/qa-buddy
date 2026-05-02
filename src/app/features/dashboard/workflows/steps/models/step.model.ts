export type StepAction = 'CLICK' | 'FILL' | 'NAVIGATE' | 'WAIT' | 'ASSERT_TEXT' | 'ASSERT_API';

export type StepSource = 'RECORDED' | 'MANUAL' | 'MIXED';

export interface StepRequest {
  action: StepAction;
  source?: StepSource;
  selector?: string;
  value?: string;
  expectedValue?: string;
  meta?: Record<string, unknown>;
  optional?: boolean;
  timeoutMs?: number;
  retryCount?: number;
}

export interface StepReorderRequest {
  stepIds: string[];
}

export interface StepView {
  id: string;
  orderIndex: number;
  action: StepAction;
  source: StepSource;
  selector: string | null;
  value: string | null;
  expectedValue: string | null;
  meta: Record<string, unknown> | null;
  optional: boolean;
  timeoutMs: number | null;
  retryCount: number;
}
