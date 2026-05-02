import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
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
  @Input() canEdit = false;
  @Input() isSaving = false;
  @Output() addStep = new EventEmitter<WorkflowStepKind>();

  selectedStepId: string | null = null;

  readonly kindLabels: Record<WorkflowStepKind, string> = {
    navigate: 'Navigate',
    click: 'Action',
    input: 'Input',
    assert: 'Check',
    wait: 'Wait',
    code: 'Code',
  };

  readonly capabilityLabels: Record<WorkflowCapability, string> = {
    payloads: 'Payloads',
    screenshots: 'Screenshots',
    apiChecks: 'API Checks',
  };

  readonly quickAddActions: readonly QuickAddAction[] = [
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

  get selectedStep(): WorkflowStep | null {
    if (!this.steps.length) {
      return null;
    }

    return this.steps.find((step) => step.id === this.selectedStepId) ?? this.steps[0] ?? null;
  }

  get lineCount(): number {
    return this.script?.split('\n').length ?? 0;
  }

  selectStep(stepId: string): void {
    this.selectedStepId = stepId;
  }

  requestAddStep(kind: WorkflowStepKind): void {
    this.addStep.emit(kind);
  }

  isSelected(stepId: string): boolean {
    return this.selectedStep?.id === stepId;
  }

  locatorLabel(locator: WorkflowLocator): string {
    return `${locator.strategy} / ${locator.value}`;
  }

  syncSelection(): void {
    if (!this.steps.length) {
      this.selectedStepId = null;
      return;
    }

    if (!this.steps.some((step) => step.id === this.selectedStepId)) {
      this.selectedStepId = this.steps[0].id;
    }
  }
}

