import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import type { RecordingPhase } from '../../models/record-contract.model';
import type {
  WorkflowCapability,
  WorkflowLocator,
  WorkflowStep,
  WorkflowStepKind,
} from '../../models/workflow-step.model';

interface QuickAddAction {
  readonly label: string;
  readonly kind: WorkflowStepKind;
}

@Component({
  selector: 'app-workflow-editor',
  standalone: true,
  templateUrl: './workflow-editor.component.html',
  styleUrl: './workflow-editor.component.scss',
})
export class WorkflowEditorComponent implements OnChanges {
  @Input() steps: readonly WorkflowStep[] = [];
  @Input() script: string | null = null;
  @Input() phase: RecordingPhase = 'idle';
  @Input() sourceUrl = '';

  protected selectedStepId: string | null = null;

  protected readonly kindLabels: Record<WorkflowStepKind, string> = {
    navigate: 'Navigate',
    click: 'Action',
    input: 'Input',
    assert: 'Check',
    wait: 'Wait',
    code: 'Code',
  };

  protected readonly capabilityLabels: Record<WorkflowCapability, string> = {
    payloads: 'Payloads',
    screenshots: 'Screenshots',
    apiChecks: 'API Checks',
  };

  protected readonly quickAddActions: readonly QuickAddAction[] = [
    { label: 'Add Step', kind: 'click' },
    { label: 'Add Input', kind: 'input' },
    { label: 'Add Check', kind: 'assert' },
    { label: 'Add Wait', kind: 'wait' },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['steps']) {
      this.syncSelection();
    }
  }

  protected get selectedStep(): WorkflowStep | null {
    if (!this.steps.length) {
      return null;
    }

    return this.steps.find((step) => step.id === this.selectedStepId) ?? this.steps[0] ?? null;
  }

  protected get lineCount(): number {
    return this.script?.split('\n').length ?? 0;
  }

  protected selectStep(stepId: string): void {
    this.selectedStepId = stepId;
  }

  protected isSelected(stepId: string): boolean {
    return this.selectedStep?.id === stepId;
  }

  protected locatorLabel(locator: WorkflowLocator): string {
    return `${locator.strategy} / ${locator.value}`;
  }

  private syncSelection(): void {
    if (!this.steps.length) {
      this.selectedStepId = null;
      return;
    }

    if (!this.steps.some((step) => step.id === this.selectedStepId)) {
      this.selectedStepId = this.steps[0].id;
    }
  }
}
