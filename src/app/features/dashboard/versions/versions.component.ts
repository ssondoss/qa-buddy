import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CodeEditor } from '@acrodata/code-editor';
import { json } from '@codemirror/lang-json';
import type {
  StepAction,
  StepRequest,
  StepSource,
  StepView,
} from '../workflows/steps/models/step.model';
import { StepService } from '../workflows/steps/services/step.service';
import type { VersionView, WorkflowResponse } from '../workflows/models/workflow.model';
import { WorkflowService } from '../workflows/services/workflow.service';
import { ExecutionService } from '../executions/services/execution.service';
import type { ExecutionView, ExecutionStepResultView } from '../executions/models/execution.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-versions',
  standalone: true,
  imports: [ReactiveFormsModule, CodeEditor],
  templateUrl: './versions.component.html',
  styleUrl: './versions.component.scss',
})
export class VersionsComponent implements OnInit {
  readonly destroyRef = inject(DestroyRef);
  readonly formBuilder = inject(FormBuilder);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);

  workflows: WorkflowResponse[] = [];
  versions: VersionView[] = [];
  steps: StepView[] = [];
  selectedWorkflowId = '';
  selectedVersionId = '';
  selectedStepKey = '';
  draggedStepKey = '';
  dragOverStepKey = '';
  isCreatingStep = false;
  editingStepId: string | null = null;
  isLoadingWorkflows = false;
  isLoadingVersions = false;
  isLoadingSteps = false;
  isSavingStep = false;
  isVersionTableOpen = true;
  isStepTableOpen = true;
  isExecuting = false;
  lastExecution: ExecutionView | null = null;
  error: string | null = null;
  success: string | null = null;
  private notificationTimer: ReturnType<typeof setTimeout> | null = null;

  readonly stepActions: readonly StepAction[] = [
    'CLICK',
    'FILL',
    'NAVIGATE',
    'WAIT',
    'ASSERT_TEXT',
    'ASSERT_API',
  ];
  readonly stepSources: readonly StepSource[] = ['RECORDED', 'MANUAL', 'MIXED'];
  readonly metaEditorExtensions = [json()];
  readonly stepForm = this.formBuilder.nonNullable.group({
    action: ['CLICK' as StepAction, [Validators.required]],
    source: ['MANUAL' as StepSource, [Validators.required]],
    selector: [''],
    value: [''],
    expectedValue: [''],
    meta: ['', [this.jsonObjectValidator]],
    optional: [false],
    timeoutMs: ['', [Validators.pattern(/^\d*$/)]],
    retryCount: ['', [Validators.pattern(/^\d*$/)]],
  });

  routeWorkflowId = '';
  routeVersionId = '';

  constructor(
    readonly stepService: StepService,
    readonly workflowService: WorkflowService,
    readonly executionService: ExecutionService,
  ) {
    this.destroyRef.onDestroy(() => this.clearNotificationTimer());
    this.stepForm.controls.source.disable();
  }

  ngOnInit(): void {
    const queryParams = this.route.snapshot.queryParamMap;
    this.routeWorkflowId = queryParams.get('workflowId') ?? '';
    this.routeVersionId = queryParams.get('versionId') ?? '';
    this.loadWorkflows();
  }

  get selectedWorkflow(): WorkflowResponse | null {
    return this.workflows.find((workflow) => workflow.id === this.selectedWorkflowId) ?? null;
  }

  get selectedVersion(): VersionView | null {
    return this.versions.find((version) => version.versionId === this.selectedVersionId) ?? null;
  }

  get selectedStep(): StepView | null {
    return this.steps.find((step) => step.id === this.selectedStepKey) ?? null;
  }

  get selectedVersionIsRecording(): boolean {
    return this.selectedVersion?.status === 'RECORDING';
  }

  get canEditSteps(): boolean {
    return Boolean(this.selectedVersionId) && !this.selectedVersionIsRecording;
  }

  get canDragSteps(): boolean {
    return Boolean(this.selectedVersionId) && !this.selectedVersionIsRecording;
  }

  get canExecuteVersion(): boolean {
    return this.selectedVersion?.status === 'READY' && !this.isExecuting;
  }

  get formModeLabel(): string {
    return this.isCreatingStep ? 'Create Step' : 'Update Step';
  }

  loadWorkflows(): void {
    this.isLoadingWorkflows = true;

    this.workflowService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.workflows = response;
          this.selectedWorkflowId = this.resolveWorkflowId();
          this.isLoadingWorkflows = false;

          if (this.selectedWorkflowId) {
            this.loadVersions(this.routeVersionId || null);
          }
        },
        error: (err: Error) => {
          this.error = this.messageFromError(err, 'Failed to load workflows');
          this.isLoadingWorkflows = false;
        },
      });
  }

  executeSelectedVersion(): void {
    const workflowId = this.selectedWorkflowId;
    const versionId = this.selectedVersionId;

    if (!workflowId || !versionId || !this.canExecuteVersion) {
      return;
    }

    this.isExecuting = true;
    this.lastExecution = null;
    this.error = null;
    this.success = null;

    this.executionService
      .execute(workflowId, versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.isExecuting = false;
          this.lastExecution = result;
          if (result.status === 'PASSED') {
            this.setSuccess(`Execution passed — v${this.selectedVersion?.versionNumber ?? ''}`);
          } else {
            this.error = `Execution ${result.status.toLowerCase().replace(/_/g, ' ')} — see results below`;
          }
        },
        error: (err: Error) => {
          this.isExecuting = false;
          this.error = this.messageFromError(err, 'Execution failed');
        },
      });
  }

  selectWorkflow(workflowId: string): void {
    this.selectedWorkflowId = workflowId;
    this.selectedVersionId = '';
    this.selectedStepKey = '';
    this.versions = [];
    this.steps = [];
    this.success = null;
    this.error = null;
    this.updateUrl();
    this.loadVersions();
  }

  selectWorkflowFromEvent(event: Event): void {
    const workflowId = (event.target as HTMLSelectElement).value;

    if (!workflowId) {
      return;
    }

    this.selectWorkflow(workflowId);
  }

  loadVersions(preferredVersionId: string | null = null): void {
    const workflow = this.selectedWorkflow;

    if (!workflow) {
      return;
    }

    this.isLoadingVersions = true;
    this.versions = [];
    this.steps = [];

    this.workflowService
      .versions(workflow.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.versions = response;
          this.selectedVersionId = this.resolveVersionId(response, preferredVersionId);
          this.isLoadingVersions = false;
          this.updateUrl();

          if (this.selectedVersionId) {
            this.loadSteps();
          }
        },
        error: (err: Error) => {
          this.error = this.messageFromError(err, 'Failed to load versions');
          this.isLoadingVersions = false;
        },
      });
  }

  selectVersion(versionId: string): void {
    this.selectedVersionId = versionId;
    this.selectedStepKey = '';
    this.success = null;
    this.error = null;
    this.updateUrl();
    this.loadSteps();
  }

  toggleVersionTable(): void {
    this.isVersionTableOpen = !this.isVersionTableOpen;
  }

  toggleStepTable(): void {
    this.isStepTableOpen = !this.isStepTableOpen;
  }

  loadSteps(): void {
    const versionId = this.selectedVersionId;

    if (!versionId) {
      return;
    }

    this.isLoadingSteps = true;

    this.stepService
      .list(versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.steps = response;
          this.isLoadingSteps = false;
          this.syncSelectedStep();
        },
        error: (err: Error) => {
          this.error = this.messageFromError(err, 'Failed to load steps');
          this.steps = [];
          this.isLoadingSteps = false;
          this.openCreateStep();
        },
      });
  }

  selectStep(step: StepView): void {
    this.selectedStepKey = step.id;
    this.isCreatingStep = false;
    this.editingStepId = step.id;
    this.populateStepForm(step);
  }

  openCreateStep(): void {
    this.isCreatingStep = true;
    this.editingStepId = null;
    this.selectedStepKey = '';
    this.stepForm.reset({
      action: 'CLICK',
      source: 'MANUAL',
      selector: '',
      value: '',
      expectedValue: '',
      meta: '',
      optional: false,
      timeoutMs: '',
      retryCount: '',
    });
  }

  saveStep(): void {
    const versionId = this.selectedVersionId;

    if (!versionId || !this.canEditSteps) {
      this.error = 'Select an editable version before saving steps.';
      return;
    }

    if (!this.isCreatingStep && !this.editingStepId) {
      this.error = 'Step id is required to update this step.';
      return;
    }

    if (this.stepForm.invalid) {
      this.stepForm.markAllAsTouched();
      return;
    }

    const payload = this.stepPayload();
    const request$ = this.isCreatingStep
      ? this.stepService.create(versionId, payload)
      : this.stepService.update(versionId, this.editingStepId as string, payload);

    this.isSavingStep = true;
    this.error = null;
    this.success = null;

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.setSuccess(this.isCreatingStep ? 'Step created' : 'Step updated');
        this.isSavingStep = false;
        this.loadSteps();
      },
      error: (err: Error) => {
        this.error = this.messageFromError(err, 'Failed to save step');
        this.isSavingStep = false;
      },
    });
  }

  deleteSelectedStep(): void {
    const step = this.selectedStep;
    const versionId = this.selectedVersionId;
    const stepId = step?.id ?? null;

    if (!versionId || !stepId) {
      this.error = 'Step id is required to delete this step.';
      return;
    }

    if (!window.confirm(`Delete step ${step?.orderIndex ?? ''}?`)) {
      return;
    }

    this.isSavingStep = true;
    this.error = null;
    this.success = null;

    this.stepService
      .delete(versionId, stepId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.setSuccess('Step deleted');
          this.isSavingStep = false;
          this.loadSteps();
        },
        error: (err: Error) => {
          this.error = this.messageFromError(err, 'Failed to delete step');
          this.isSavingStep = false;
        },
      });
  }

  moveStep(step: StepView, direction: -1 | 1): void {
    const currentIndex = this.steps.indexOf(step);
    const targetIndex = currentIndex + direction;

    if (
      !this.selectedVersionId ||
      targetIndex < 0 ||
      targetIndex >= this.steps.length ||
      this.selectedVersionIsRecording
    ) {
      return;
    }

    const reordered = [...this.steps];
    [reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[currentIndex],
    ];
    this.reorderSteps(reordered);
  }

  startStepDrag(event: DragEvent, step: StepView): void {
    if (!this.selectedVersionId || this.selectedVersionIsRecording) {
      event.preventDefault();
      return;
    }

    this.draggedStepKey = step.id;
    this.dragOverStepKey = '';
    event.dataTransfer?.setData('text/plain', this.draggedStepKey);
    event.dataTransfer?.setDragImage(event.target as Element, 0, 0);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  dragOverStep(event: DragEvent, step: StepView): void {
    if (!this.canDragSteps || !this.draggedStepKey) {
      return;
    }

    event.preventDefault();
    this.dragOverStepKey = step.id;

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  leaveStepDrag(step: StepView): void {
    if (this.dragOverStepKey === step.id) {
      this.dragOverStepKey = '';
    }
  }

  dropStep(event: DragEvent, targetStep: StepView): void {
    event.preventDefault();

    if (!this.canDragSteps || !this.draggedStepKey) {
      this.clearStepDrag();
      return;
    }

    const draggedIndex = this.steps.findIndex((step) => step.id === this.draggedStepKey);
    const targetIndex = this.steps.indexOf(targetStep);

    if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) {
      this.clearStepDrag();
      return;
    }

    const reordered = [...this.steps];
    const [draggedStep] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, draggedStep);
    this.clearStepDrag();
    this.reorderSteps(reordered);
  }

  endStepDrag(): void {
    this.clearStepDrag();
  }

  isDraggingStep(step: StepView): boolean {
    return this.draggedStepKey === step.id;
  }

  isDropTarget(step: StepView): boolean {
    const stepKey = step.id;
    return (
      Boolean(this.draggedStepKey) &&
      this.draggedStepKey !== stepKey &&
      this.dragOverStepKey === stepKey
    );
  }

  reorderSteps(reordered: StepView[]): void {
    if (!this.selectedVersionId || this.selectedVersionIsRecording) {
      return;
    }

    const previousSteps = this.steps;
    const stepIds = reordered.map((item) => item.id);

    this.steps = reordered;
    this.isSavingStep = true;
    this.error = null;
    this.success = null;

    this.stepService
      .reorder(this.selectedVersionId, {
        stepIds,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.steps = response;
          this.setSuccess('Steps reordered');
          this.isSavingStep = false;
          this.syncSelectedStep();
        },
        error: (err: Error) => {
          this.steps = previousSteps;
          this.error = this.messageFromError(err, 'Failed to reorder steps');
          this.isSavingStep = false;
        },
      });
  }

  clearStepDrag(): void {
    this.draggedStepKey = '';
    this.dragOverStepKey = '';
  }

  dismissError(): void {
    this.error = null;
  }

  dismissSuccess(): void {
    this.success = null;
    this.clearNotificationTimer();
  }

  setSuccess(message: string): void {
    this.success = message;
    this.error = null;
    this.clearNotificationTimer();
    this.notificationTimer = setTimeout(() => {
      this.success = null;
      this.notificationTimer = null;
    }, 4000);
  }

  clearNotificationTimer(): void {
    if (!this.notificationTimer) {
      return;
    }

    clearTimeout(this.notificationTimer);
    this.notificationTimer = null;
  }

  statusLabel(status: string): string {
    return status
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  statusToken(status: string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  isSelectedStep(step: StepView): boolean {
    return step.id === this.selectedStepKey;
  }

  stepTarget(step: StepView): string {
    return step.selector ?? step.value ?? step.expectedValue ?? '-';
  }

  isStepFieldInvalid(
    fieldName:
      | 'action'
      | 'source'
      | 'selector'
      | 'value'
      | 'expectedValue'
      | 'meta'
      | 'timeoutMs'
      | 'retryCount',
  ): boolean {
    const control = this.stepForm.controls[fieldName];
    return control.invalid && (control.touched || control.dirty);
  }

  syncSelectedStep(): void {
    const selected =
      this.steps.find((step) => step.id === this.selectedStepKey) ?? this.steps[0] ?? null;

    if (selected) {
      this.selectStep(selected);
      return;
    }

    this.openCreateStep();
  }

  populateStepForm(step: StepView): void {
    this.stepForm.reset({
      action: step.action,
      source: step.source,
      selector: step.selector ?? '',
      value: step.value ?? '',
      expectedValue: step.expectedValue ?? '',
      meta: Object.keys(step.meta ?? {}).length ? JSON.stringify(step.meta, null, 2) : '',
      optional: step.optional,
      timeoutMs: step.timeoutMs?.toString() ?? '',
      retryCount: step.retryCount.toString(),
    });
  }

  stepPayload(): StepRequest {
    const value = this.stepForm.getRawValue();
    const payload: StepRequest = {
      action: value.action,
      source: value.source,
      optional: value.optional,
    };

    this.assignOptionalString(payload, 'selector', value.selector);
    this.assignOptionalString(payload, 'value', value.value);
    this.assignOptionalString(payload, 'expectedValue', value.expectedValue);

    const timeoutMs = this.optionalNumber(value.timeoutMs);
    const retryCount = this.optionalNumber(value.retryCount);

    if (timeoutMs !== null) {
      payload.timeoutMs = timeoutMs;
    }

    if (retryCount !== null) {
      payload.retryCount = retryCount;
    }

    const meta = value.meta.trim();

    if (meta) {
      payload.meta = JSON.parse(meta) as Record<string, unknown>;
    }

    return payload;
  }

  assignOptionalString<T extends 'selector' | 'value' | 'expectedValue'>(
    payload: StepRequest,
    fieldName: T,
    value: string,
  ): void {
    const trimmed = value.trim();

    if (trimmed) {
      payload[fieldName] = trimmed;
    }
  }

  optionalNumber(value: string): number | null {
    const trimmed = value.trim();
    return trimmed ? Number(trimmed) : null;
  }

  resolveWorkflowId(): string {
    if (
      this.routeWorkflowId &&
      this.workflows.some((workflow) => workflow.id === this.routeWorkflowId)
    ) {
      return this.routeWorkflowId;
    }

    if (
      this.selectedWorkflowId &&
      this.workflows.some((workflow) => workflow.id === this.selectedWorkflowId)
    ) {
      return this.selectedWorkflowId;
    }

    return this.workflows[0]?.id ?? '';
  }

  resolveVersionId(versions: readonly VersionView[], preferredVersionId: string | null): string {
    const versionIds = new Set(versions.map((version) => version.versionId));

    if (preferredVersionId && versionIds.has(preferredVersionId)) {
      return preferredVersionId;
    }

    return versions[0]?.versionId ?? '';
  }

  updateUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        workflowId: this.selectedWorkflowId || null,
        versionId: this.selectedVersionId || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  jsonObjectValidator(control: AbstractControl<string>): ValidationErrors | null {
    const value = control.value?.trim();

    if (!value) {
      return null;
    }

    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? null
        : { jsonObject: true };
    } catch {
      return { jsonObject: true };
    }
  }

  screenshotUrl(relativePath: string | null): string | null {
    return relativePath ? `${environment.apiHost}${relativePath}` : null;
  }

  stepResultAction(step: ExecutionStepResultView): string {
    return String(step.stepSnapshot['action'] ?? '');
  }

  stepResultSelector(step: ExecutionStepResultView): string {
    return String(step.stepSnapshot['selector'] ?? step.stepSnapshot['value'] ?? '');
  }

  messageFromError(error: Error, fallback: string): string {
    return error.message || fallback;
  }
}
