import { Component, Input } from '@angular/core';
import type { RecordingPhase } from '../../models/record-contract.model';
import type {
  WorkflowCapability,
  WorkflowLocator,
  WorkflowStep,
  WorkflowStepKind,
} from '../../models/workflow-step.model';

@Component({
  selector: 'app-workflow-editor',
  standalone: true,
  templateUrl: './workflow-editor.component.html',
  styleUrl: './workflow-editor.component.scss',
})
export class WorkflowEditorComponent {
  @Input() steps: readonly WorkflowStep[] = [];
  @Input() script: string | null = null;
  @Input() phase: RecordingPhase = 'idle';
  @Input() sourceUrl = '';

  protected readonly kindLabels: Record<WorkflowStepKind, string> = {
    navigate: 'Navigate',
    click: 'Action',
    input: 'Data',
    assert: 'Verify',
    wait: 'Sync',
    code: 'Code',
  };

  protected readonly capabilityLabels: Record<WorkflowCapability, string> = {
    payloads: 'Payload-ready',
    screenshots: 'Screenshot hook',
    apiChecks: 'API check slot',
  };

  protected get headlineStats() {
    const steps = this.steps;
    const interactive = steps.filter((step) => step.kind === 'click' || step.kind === 'input').length;
    const validations = steps.filter((step) => step.kind === 'assert').length;

    return [
      { label: 'steps mapped', value: steps.length, tone: 'neutral' },
      { label: 'interactive actions', value: interactive, tone: 'action' },
      { label: 'checks ready', value: validations, tone: 'verify' },
    ];
  }

  protected get lineCount(): number {
    return this.script?.split('\n').length ?? 0;
  }

  protected locatorLabel(locator: WorkflowLocator): string {
    return `${locator.strategy} · ${locator.value}`;
  }
}
