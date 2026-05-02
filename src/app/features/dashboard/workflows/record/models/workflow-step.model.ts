export type WorkflowStepKind = 'navigate' | 'click' | 'input' | 'assert' | 'wait' | 'code';

export type WorkflowCapability = 'payloads' | 'screenshots' | 'apiChecks';

export interface WorkflowLocator {
  strategy: 'testId' | 'text' | 'role' | 'locator' | 'url';
  value: string;
}

export interface WorkflowStep {
  id: string;
  stepId?: string;
  order: number;
  sourceLine: number;
  kind: WorkflowStepKind;
  title: string;
  detail: string;
  code: string;
  locator?: WorkflowLocator;
  capabilities: readonly WorkflowCapability[];
}
