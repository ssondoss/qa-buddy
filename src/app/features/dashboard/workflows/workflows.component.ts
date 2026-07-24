import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import type { EnvironmentResponse } from '../environments/models/environment.model';
import { EnvironmentService } from '../environments/services/environment.service';
import type { RecordingPhase } from './record/models/record-contract.model';
import type {
  VersionAliasUpdateRequest,
  VersionView,
  WorkflowDeletePreview,
  WorkflowRecordingStartRequest,
  WorkflowResponse,
  WorkflowUpsertRequest,
} from './models/workflow.model';
import { WorkflowService } from './services/workflow.service';
import { ExecutionService } from '../executions/services/execution.service';
import { DiscoveryService } from './steps/services/discovery.service';
import { StepService } from './steps/services/step.service';
import type { StepApiDiscoveryResult, StepDiscoveredApiView } from './steps/models/discovered-api.model';
import type { StepAction, StepRequest, StepView } from './steps/models/step.model';
import type { ExecutionView } from '../executions/models/execution.model';

@Component({
  selector: 'app-workflows',
  standalone: true,
  imports: [ReactiveFormsModule, NgTemplateOutlet],
  templateUrl: './workflows.component.html',
  styleUrl: './workflows.component.scss',
})
export class WorkflowsComponent implements OnInit {
  readonly destroyRef = inject(DestroyRef);
  readonly formBuilder = inject(FormBuilder);

  phase: RecordingPhase = 'idle';
  error: string | null = null;
  workflowSuccess: string | null = null;
  private notificationTimer: ReturnType<typeof setTimeout> | null = null;
  showWorkflowForm = false;
  showCapturePanel = false;
  isCreatingWorkflow = false;
  isLoadingEnvironments = false;
  isLoadingWorkflows = false;
  isWorkflowTableOpen = true;
  selectedWorkflowId = '';

  expandedWorkflowId: string | null = null;
  expandedVersionId: string | null = null;
  selectedVersionId: string | null = null;
  versionsMap: Record<string, VersionView[]> = {};
  versionsLoadingMap: Record<string, boolean> = {};
  modalVersion: VersionView | null = null;
  modalWorkflowName = '';
  cellModalText: string | null = null;
  cellModalLabel = '';
  executingVersionId: string | null = null;
  discoveringVersionId: string | null = null;
  discoveryResults: StepApiDiscoveryResult[] = [];
  discoveryVersionId: string | null = null;

  showDiscoveryPicker = false;
  discoveryPickerWorkflowId = '';
  discoveryPickerVersion: VersionView | null = null;
  discoveryPickerSteps: StepView[] = [];
  discoveryPickerSelectedIds = new Set<string>();
  isLoadingDiscoveryPickerSteps = false;

  versionSteps: StepView[] = [];
  versionExecutions: ExecutionView[] = [];
  stepsVersionId: string | null = null;
  isLoadingSteps = false;

  editingStepId: string | null = null;
  isAddingStep = false;
  isSavingStep = false;
  deletingStepId: string | null = null;

  // Drag-and-drop step reorder
  draggingStepId: string | null = null;
  dropTargetStepId: string | null = null;

  // Alias editing
  editingAliasVersionId: string | null = null;
  aliasInputValue = '';
  isSavingAlias = false;

  // Duplicate state
  duplicatingVersionId: string | null = null;
  duplicatingStepId: string | null = null;

  // Delete confirmations
  deletePreviewWorkflowId: string | null = null;
  deletePreviewWorkflow: WorkflowResponse | null = null;
  deleteWorkflowPreview: WorkflowDeletePreview | null = null;
  isLoadingDeletePreview = false;
  isDeletingWorkflow = false;
  confirmingDeleteVersionId: string | null = null;
  isDeletingVersion = false;
  confirmingDeleteStepId: string | null = null;
  stepForm: {
    action: StepAction;
    selector: string;
    value: string;
    expectedValue: string;
    timeoutMs: number | null;
    optional: boolean;
    retryCount: number;
    metaJson: string;
    apiUrl: string;
    apiMethod: string;
    apiExpectedStatus: number | null;
    apiBodyContains: string;
  } = {
    action: 'CLICK',
    selector: '',
    value: '',
    expectedValue: '',
    timeoutMs: null,
    optional: false,
    retryCount: 0,
    metaJson: '{}',
    apiUrl: '',
    apiMethod: 'GET',
    apiExpectedStatus: null,
    apiBodyContains: '',
  };
  assertionSelections = new Map<string, {
    api: StepDiscoveredApiView;
    expectedStatus: number | null;
    expectedBodyContains: string;
  }>();

  // Workflow pagination
  workflowsPage = 0;
  workflowsTotalPages = 0;
  workflowsTotalElements = 0;

  // Version pagination per workflow
  versionsPaginationMap: Record<string, { page: number; totalPages: number }> = {};

  // Steps frontend-slice pagination
  stepsPage = 0;
  readonly stepsPageSize = 5;

  // Detail modals
  modalWorkflow: WorkflowResponse | null = null;
  modalStep: StepView | null = null;
  isEditingWorkflowModal = false;
  isSavingWorkflowEdit = false;

  // Auto-select after recording
  pendingVersionSelect: { workflowId: string; versionId: string } | null = null;

  workflows: WorkflowResponse[] = [];
  recordingEnvironments: EnvironmentResponse[] = [];

  readonly workflowForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.maxLength(2000)]],
  });
  readonly workflowEditForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.maxLength(2000)]],
  });
  readonly recordingForm = this.formBuilder.nonNullable.group({
    environmentId: ['', [Validators.required]],
    startPath: ['', [Validators.maxLength(1000), this.relativePathValidator]],
    alias: ['', [Validators.maxLength(100)]],
  });

  private recordingEmitter: EventSource | null = null;

  constructor(
    readonly environmentService: EnvironmentService,
    readonly workflowService: WorkflowService,
    readonly executionService: ExecutionService,
    readonly discoveryService: DiscoveryService,
    readonly stepService: StepService,
    readonly router: Router,
  ) {
    this.destroyRef.onDestroy(() => {
      this.clearNotificationTimer();
      this.closeRecordingEmitter();
    });
  }

  ngOnInit(): void {
    this.loadWorkflows();
    this.loadRecordingEnvironments();
  }

  get selectedWorkflow(): WorkflowResponse | null {
    return this.workflows.find((workflow) => workflow.id === this.selectedWorkflowId) ?? null;
  }

  get selectedVersion(): VersionView | null {
    if (!this.selectedVersionId || !this.expandedWorkflowId) {
      return null;
    }
    return (
      this.versionsMap[this.expandedWorkflowId]?.find(
        (v) => v.versionId === this.selectedVersionId,
      ) ?? null
    );
  }

  get pagedSteps(): StepView[] {
    const start = this.stepsPage * this.stepsPageSize;
    return this.versionSteps.slice(start, start + this.stepsPageSize);
  }

  get stepsTotalPages(): number {
    return Math.max(1, Math.ceil(this.versionSteps.length / this.stepsPageSize));
  }

  loadWorkflows(page = 0): void {
    this.isLoadingWorkflows = true;
    this.workflowsPage = page;

    this.workflowService
      .list(page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.workflows = response.items;
          this.workflowsTotalPages = response.totalPages;
          this.workflowsTotalElements = response.totalElements;

          if (!this.selectedWorkflowId && this.workflows.length) {
            this.selectedWorkflowId = this.workflows[0].id;
          }

          if (
            this.selectedWorkflowId &&
            !this.workflows.some((workflow) => workflow.id === this.selectedWorkflowId)
          ) {
            this.selectedWorkflowId = this.workflows[0]?.id ?? '';
          }

          this.isLoadingWorkflows = false;
        },
        error: () => {
          this.isLoadingWorkflows = false;
        },
      });
  }

  loadRecordingEnvironments(): void {
    this.isLoadingEnvironments = true;

    this.environmentService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.recordingEnvironments = response;

          if (!this.recordingForm.controls.environmentId.value && response.length) {
            this.recordingForm.controls.environmentId.setValue(response[0].id);
          }

          if (
            this.recordingForm.controls.environmentId.value &&
            !response.some(
              (environment) => environment.id === this.recordingForm.controls.environmentId.value,
            )
          ) {
            this.recordingForm.controls.environmentId.setValue(response[0]?.id ?? '');
          }

          this.isLoadingEnvironments = false;
        },
        error: () => {
          this.isLoadingEnvironments = false;
        },
      });
  }

  selectWorkflow(workflowId: string): void {
    this.selectedWorkflowId = workflowId;
    this.error = null;
  }

  openRecordingModal(): void {
    this.showCapturePanel = true;
  }

  closeRecordingModal(): void {
    this.showCapturePanel = false;
    this.recordingForm.patchValue({ alias: '' });
  }

  selectVersionRow(version: VersionView, workflowId: string): void {
    if (this.expandedVersionId === version.versionId) {
      this.expandedVersionId = null;
      this.selectedVersionId = null;
      return;
    }

    this.selectedVersionId = version.versionId;
    this.expandedVersionId = version.versionId;
    this.discoveryResults = [];
    this.discoveryVersionId = null;
    this.loadStepsForVersion(version.versionId);

    if (version.status !== 'READY') return;

    this.discoveryService
      .getDiscoveredApis(workflowId, version.versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => {
          const hasApis = results.some((r) => r.apis.length > 0);
          if (hasApis) {
            this.discoveryResults = results;
            this.discoveryVersionId = version.versionId;
          }
        },
        error: () => {},
      });
  }

  onWorkflowRowClick(workflowId: string): void {
    this.selectWorkflow(workflowId);
    this.selectedVersionId = null;
    this.expandedVersionId = null;

    if (this.expandedWorkflowId === workflowId) {
      this.expandedWorkflowId = null;
    } else {
      this.expandedWorkflowId = workflowId;
      this.loadVersionsForWorkflow(workflowId, 0);
    }
  }

  loadVersionsForWorkflow(workflowId: string, page = 0): void {
    this.versionsLoadingMap = { ...this.versionsLoadingMap, [workflowId]: true };

    this.workflowService
      .versions(workflowId, page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.versionsMap = { ...this.versionsMap, [workflowId]: response.items };
          this.versionsPaginationMap = {
            ...this.versionsPaginationMap,
            [workflowId]: { page: response.page, totalPages: response.totalPages },
          };
          this.versionsLoadingMap = { ...this.versionsLoadingMap, [workflowId]: false };

          if (this.pendingVersionSelect?.workflowId === workflowId) {
            const target = response.items.find(
              (v) => v.versionId === this.pendingVersionSelect!.versionId,
            );
            if (target) {
              this.pendingVersionSelect = null;
              this.selectVersionRow(target, workflowId);
            }
          }
        },
        error: () => {
          this.versionsMap = { ...this.versionsMap, [workflowId]: [] };
          this.versionsLoadingMap = { ...this.versionsLoadingMap, [workflowId]: false };
        },
      });
  }

  openVersionModal(version: VersionView, workflowName: string): void {
    this.modalVersion = version;
    this.modalWorkflowName = workflowName;
  }

  closeVersionModal(): void {
    this.modalVersion = null;
    this.modalWorkflowName = '';
  }

  openWorkflowModal(workflow: WorkflowResponse): void {
    this.modalWorkflow = workflow;
  }

  closeWorkflowModal(): void {
    this.modalWorkflow = null;
    this.isEditingWorkflowModal = false;
  }

  openEditWorkflowModal(): void {
    if (!this.modalWorkflow) return;
    this.workflowEditForm.reset({
      name: this.modalWorkflow.name,
      description: this.modalWorkflow.description ?? '',
    });
    this.isEditingWorkflowModal = true;
  }

  cancelEditWorkflowModal(): void {
    this.isEditingWorkflowModal = false;
  }

  saveWorkflowEdit(): void {
    if (!this.modalWorkflow) return;
    if (this.workflowEditForm.invalid) {
      this.workflowEditForm.markAllAsTouched();
      return;
    }
    const { name, description } = this.workflowEditForm.getRawValue();
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    if (!trimmedName) {
      this.workflowEditForm.controls.name.setErrors({ required: true });
      return;
    }
    const payload: WorkflowUpsertRequest = trimmedDesc ? { name: trimmedName, description: trimmedDesc } : { name: trimmedName };
    this.isSavingWorkflowEdit = true;
    this.workflowService
      .update(this.modalWorkflow.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.isSavingWorkflowEdit = false;
          this.modalWorkflow = updated;
          this.replaceWorkflow(updated);
          this.isEditingWorkflowModal = false;
          this.setWorkflowSuccess('Workflow updated');
        },
        error: (err: Error) => {
          this.isSavingWorkflowEdit = false;
          this.error = this.messageFromError(err, 'Failed to update workflow');
        },
      });
  }

  isWorkflowEditFieldInvalid(field: 'name' | 'description'): boolean {
    const control = this.workflowEditForm.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  navigateToWorkflowVersions(workflowId: string): void {
    this.router.navigate(['/dashboard/versions'], { queryParams: { workflowId } });
  }

  openStepModal(step: StepView): void {
    this.modalStep = step;
  }

  closeStepModal(): void {
    this.modalStep = null;
  }

  openCellModal(label: string, text: string): void {
    this.cellModalLabel = label;
    this.cellModalText = text;
  }

  closeCellModal(): void {
    this.cellModalText = null;
    this.cellModalLabel = '';
  }

  goToWorkflowsPage(page: number): void {
    if (page < 0 || page >= this.workflowsTotalPages) return;
    this.expandedWorkflowId = null;
    this.expandedVersionId = null;
    this.loadWorkflows(page);
  }

  goToVersionsPage(workflowId: string, page: number): void {
    const pagination = this.versionsPaginationMap[workflowId];
    if (!pagination || page < 0 || page >= pagination.totalPages) return;
    this.expandedVersionId = null;
    this.loadVersionsForWorkflow(workflowId, page);
  }

  goToStepsPage(page: number): void {
    if (page < 0 || page >= this.stepsTotalPages) return;
    this.stepsPage = page;
  }

  // ── Drag-and-drop step reorder ───────────────────────────────────────────────

  startStepDrag(event: DragEvent, step: StepView): void {
    this.draggingStepId = step.id;
    this.dropTargetStepId = null;
    event.dataTransfer?.setData('text/plain', step.id);
  }

  endStepDrag(): void {
    this.draggingStepId = null;
    this.dropTargetStepId = null;
  }

  dragOverStep(event: DragEvent, step: StepView): void {
    if (!this.draggingStepId || this.draggingStepId === step.id) return;
    event.preventDefault();
    this.dropTargetStepId = step.id;
  }

  leaveStepDrag(step: StepView): void {
    if (this.dropTargetStepId === step.id) this.dropTargetStepId = null;
  }

  dropStep(event: DragEvent, targetStep: StepView): void {
    event.preventDefault();
    if (!this.draggingStepId || this.draggingStepId === targetStep.id || !this.stepsVersionId) {
      this.endStepDrag();
      return;
    }
    const newOrder = [...this.versionSteps];
    const fromIdx = newOrder.findIndex((s) => s.id === this.draggingStepId);
    const toIdx = newOrder.findIndex((s) => s.id === targetStep.id);
    if (fromIdx === -1 || toIdx === -1) { this.endStepDrag(); return; }
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    this.endStepDrag();
    this.applyReorder(this.stepsVersionId, newOrder);
  }

  isDraggingStep(step: StepView): boolean {
    return this.draggingStepId === step.id;
  }

  isDropTarget(step: StepView): boolean {
    return !!this.draggingStepId && this.draggingStepId !== step.id && this.dropTargetStepId === step.id;
  }

  // ── Delete with confirmation ──────────────────────────────────────────────────

  requestDeleteWorkflow(event: Event, workflow: WorkflowResponse): void {
    event.stopPropagation();
    if (this.modalWorkflow?.id === workflow.id) this.closeWorkflowModal();
    this.deletePreviewWorkflowId = workflow.id;
    this.deletePreviewWorkflow = workflow;
    this.deleteWorkflowPreview = null;
    this.isLoadingDeletePreview = true;
    this.workflowService
      .getDeletePreview(workflow.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (preview) => {
          this.deleteWorkflowPreview = preview;
          this.isLoadingDeletePreview = false;
        },
        error: () => {
          this.isLoadingDeletePreview = false;
          this.deletePreviewWorkflowId = null;
          this.deletePreviewWorkflow = null;
        },
      });
  }

  cancelDeleteWorkflow(): void {
    this.deletePreviewWorkflowId = null;
    this.deletePreviewWorkflow = null;
    this.deleteWorkflowPreview = null;
    this.isLoadingDeletePreview = false;
  }

  confirmDeleteWorkflow(): void {
    const workflowId = this.deletePreviewWorkflowId;
    if (!workflowId || this.isDeletingWorkflow) return;
    this.isDeletingWorkflow = true;
    this.workflowService
      .delete(workflowId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isDeletingWorkflow = false;
          this.cancelDeleteWorkflow();
          if (this.expandedWorkflowId === workflowId) this.expandedWorkflowId = null;
          if (this.selectedWorkflowId === workflowId) this.selectedWorkflowId = '';
          this.loadWorkflows(this.workflowsPage);
          this.setWorkflowSuccess('Workflow deleted');
        },
        error: (err: Error) => {
          this.isDeletingWorkflow = false;
          this.error = this.messageFromError(err, 'Failed to delete workflow');
        },
      });
  }

  requestDeleteVersion(event: Event, versionId: string): void {
    event.stopPropagation();
    this.confirmingDeleteVersionId = versionId;
  }

  cancelDeleteVersion(): void {
    this.confirmingDeleteVersionId = null;
  }

  confirmDeleteVersion(workflowId: string, versionId: string): void {
    if (this.isDeletingVersion) return;
    this.isDeletingVersion = true;
    this.workflowService
      .deleteVersion(workflowId, versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isDeletingVersion = false;
          this.confirmingDeleteVersionId = null;
          if (this.expandedVersionId === versionId) {
            this.expandedVersionId = null;
            this.selectedVersionId = null;
          }
          this.loadVersionsForWorkflow(workflowId, this.versionsPaginationMap[workflowId]?.page ?? 0);
          this.setWorkflowSuccess('Version deleted');
        },
        error: (err: Error) => {
          this.isDeletingVersion = false;
          this.error = this.messageFromError(err, 'Failed to delete version');
        },
      });
  }

  duplicateVersion(event: Event, workflowId: string, version: VersionView): void {
    event.stopPropagation();
    if (this.duplicatingVersionId) return;
    this.duplicatingVersionId = version.versionId;
    this.workflowService
      .duplicateVersion(workflowId, version.versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.duplicatingVersionId = null;
          this.loadVersionsForWorkflow(workflowId, this.versionsPaginationMap[workflowId]?.page ?? 0);
          this.setWorkflowSuccess(`v${version.versionNumber} duplicated`);
        },
        error: (err: Error) => {
          this.duplicatingVersionId = null;
          this.error = this.messageFromError(err, 'Failed to duplicate version');
        },
      });
  }

  duplicateStep(versionId: string, step: StepView): void {
    if (this.duplicatingStepId || this.isSavingStep) return;
    this.duplicatingStepId = step.id;
    this.stepService
      .duplicate(versionId, step.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (newStep) => {
          this.duplicatingStepId = null;
          this.versionSteps = [...this.versionSteps, newStep];
          this.setWorkflowSuccess('Step duplicated');
        },
        error: (err: Error) => {
          this.duplicatingStepId = null;
          this.error = this.messageFromError(err, 'Failed to duplicate step');
        },
      });
  }

  requestDeleteStep(event: Event, stepId: string): void {
    event.stopPropagation();
    this.confirmingDeleteStepId = stepId;
  }

  cancelDeleteStep(): void {
    this.confirmingDeleteStepId = null;
  }

  metaString(meta: Record<string, unknown> | null): string {
    if (!meta) return '';
    try {
      return JSON.stringify(meta, null, 2);
    } catch {
      return '';
    }
  }

  navigateToVersionExecutions(workflowId: string, versionId: string): void {
    this.router.navigate(['/dashboard/executions'], {
      queryParams: { workflowId, versionId },
    });
  }

  navigateToStepApis(stepId: string): void {
    this.router.navigate(['/dashboard/discovered-apis'], {
      queryParams: {
        workflowId: this.selectedWorkflowId || undefined,
        versionId: this.stepsVersionId || undefined,
        stepId,
      },
    });
  }

  openAliasEditor(event: Event, version: VersionView): void {
    event.stopPropagation();
    this.editingAliasVersionId = version.versionId;
    this.aliasInputValue = version.alias ?? '';
  }

  cancelAliasEditor(): void {
    this.editingAliasVersionId = null;
    this.aliasInputValue = '';
  }

  saveAlias(workflowId: string, version: VersionView): void {
    const alias = this.aliasInputValue.trim() || null;
    this.isSavingAlias = true;
    this.error = null;

    this.workflowService
      .updateVersionAlias(workflowId, version.versionId, { alias } satisfies VersionAliasUpdateRequest)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.versionsMap = {
            ...this.versionsMap,
            [workflowId]: (this.versionsMap[workflowId] ?? []).map((v) =>
              v.versionId === version.versionId ? updated : v,
            ),
          };
          if (this.modalVersion?.versionId === version.versionId) {
            this.modalVersion = updated;
          }
          this.editingAliasVersionId = null;
          this.aliasInputValue = '';
          this.isSavingAlias = false;
          this.setWorkflowSuccess('Alias saved');
        },
        error: (err: Error) => {
          this.error = this.messageFromError(err, 'Failed to save alias');
          this.isSavingAlias = false;
        },
      });
  }

  executeVersion(workflowId: string, version: VersionView): void {
    if (this.executingVersionId || version.status !== 'READY') {
      return;
    }

    this.executingVersionId = version.versionId;
    this.error = null;

    this.executionService
      .execute(workflowId, version.versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.executingVersionId = null;
          if (result.status === 'PASSED') {
            this.setWorkflowSuccess(`Execution passed — v${version.versionNumber}`);
          } else {
            this.error = `Execution ${result.status.toLowerCase().replace(/_/g, ' ')} — v${version.versionNumber}`;
          }
        },
        error: (err: Error) => {
          this.executingVersionId = null;
          this.error = this.messageFromError(err, 'Execution failed');
        },
      });
  }

  loadStepsForVersion(versionId: string): void {
    if (this.stepsVersionId === versionId) return;
    this.isLoadingSteps = true;
    this.versionSteps = [];
    this.versionExecutions = [];
    this.editingStepId = null;
    this.isAddingStep = false;
    this.stepsPage = 0;

    this.stepService
      .list(versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (steps) => {
          this.versionSteps = steps;
          this.stepsVersionId = versionId;
          this.isLoadingSteps = false;
        },
        error: () => {
          this.isLoadingSteps = false;
        },
      });

    if (this.selectedWorkflowId) {
      this.executionService
        .listByWorkflow(this.selectedWorkflowId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (executions) => {
            this.versionExecutions = executions.filter((e) => e.versionId === versionId);
          },
          error: () => {
            this.versionExecutions = [];
          },
        });
    }
  }

  stepExecutionCount(stepId: string): number {
    return this.versionExecutions.reduce(
      (count, exec) => count + exec.stepResults.filter((sr) => sr.stepId === stepId).length,
      0,
    );
  }

  discoveredApisForStep(stepId: string): StepDiscoveredApiView[] {
    return this.discoveryResults.find((r) => r.stepId === stepId)?.apis ?? [];
  }

  openEditStep(step: StepView): void {
    this.isAddingStep = false;
    this.assertionSelections = new Map();
    this.editingStepId = step.id;
    this.stepForm = this.stepFormFromView(step);
    this.modalStep = null;
  }

  closeEditStep(): void {
    this.editingStepId = null;
    this.resetStepForm();
  }

  openAddStep(): void {
    this.editingStepId = null;
    this.isAddingStep = true;
    this.resetStepForm();
    this.assertionSelections = new Map();
  }

  closeAddStep(): void {
    this.isAddingStep = false;
    this.resetStepForm();
    this.assertionSelections = new Map();
  }

  onStepActionChange(action: StepAction): void {
    this.stepForm.action = action;
    this.stepForm.selector = '';
    this.stepForm.value = '';
    this.stepForm.expectedValue = '';
    this.stepForm.apiUrl = '';
    this.stepForm.apiMethod = 'GET';
    this.stepForm.apiExpectedStatus = null;
    this.stepForm.apiBodyContains = '';
    if (action !== 'ASSERT_API') {
      this.assertionSelections = new Map();
    }
  }

  saveEditStep(versionId: string): void {
    if (!this.editingStepId || this.isSavingStep) return;
    this.isSavingStep = true;
    const stepId = this.editingStepId;

    this.stepService
      .update(versionId, stepId, this.buildStepPayload())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.isSavingStep = false;
          this.versionSteps = this.versionSteps.map((s) => (s.id === updated.id ? updated : s));
          this.closeEditStep();
        },
        error: (err: Error) => {
          this.isSavingStep = false;
          this.error = this.messageFromError(err, 'Failed to update step');
        },
      });
  }

  saveNewStep(versionId: string): void {
    if (this.isSavingStep) return;
    this.isSavingStep = true;

    if (this.stepForm.action === 'ASSERT_API' && this.assertionSelections.size > 0) {
      const entries = [...this.assertionSelections.values()];
      const count = entries.length;
      const requests = entries.map(({ api, expectedStatus, expectedBodyContains }) =>
        this.stepService.create(versionId, {
          action: 'ASSERT_API',
          source: 'MANUAL',
          meta: {
            url: api.url,
            method: api.method,
            ...(expectedStatus != null && { expectedStatus }),
            ...(expectedBodyContains.trim() && { expectedBodyContains: expectedBodyContains.trim() }),
          },
        }),
      );

      forkJoin(requests)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.isSavingStep = false;
            this.closeAddStep();
            this.stepsVersionId = null;
            this.loadStepsForVersion(versionId);
            this.setWorkflowSuccess(`${count} assertion step${count > 1 ? 's' : ''} added`);
          },
          error: (err: Error) => {
            this.isSavingStep = false;
            this.error = this.messageFromError(err, 'Failed to add assertions');
          },
        });
      return;
    }

    this.stepService
      .create(versionId, this.buildStepPayload())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (step) => {
          this.isSavingStep = false;
          this.versionSteps = [...this.versionSteps, step];
          this.closeAddStep();
          this.setWorkflowSuccess('Step added');
        },
        error: (err: Error) => {
          this.isSavingStep = false;
          this.error = this.messageFromError(err, 'Failed to add step');
        },
      });
  }

  deleteStep(versionId: string, stepId: string): void {
    if (this.deletingStepId) return;
    this.confirmingDeleteStepId = null;
    this.deletingStepId = stepId;
    if (this.editingStepId === stepId) this.closeEditStep();

    this.stepService
      .delete(versionId, stepId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingStepId = null;
          this.versionSteps = this.versionSteps
            .filter((s) => s.id !== stepId)
            .map((s, i) => ({ ...s, orderIndex: i + 1 }));
          if (this.stepsPage >= this.stepsTotalPages) {
            this.stepsPage = Math.max(0, this.stepsTotalPages - 1);
          }
        },
        error: (err: Error) => {
          this.deletingStepId = null;
          this.error = this.messageFromError(err, 'Failed to delete step');
        },
      });
  }

  stepSummary(step: StepView): string {
    switch (step.action) {
      case 'NAVIGATE':    return step.value ?? '';
      case 'CLICK':       return step.selector ?? '';
      case 'FILL':        return `${step.selector ?? ''} → "${step.value ?? ''}"`;
      case 'WAIT':        return step.selector ?? (step.value ? `${step.value}ms` : '');
      case 'ASSERT_TEXT': return `${step.selector ?? ''} = "${step.expectedValue ?? ''}"`;
      case 'ASSERT_API': {
        const m = step.meta ?? {};
        return `${m['method'] ?? ''} ${m['url'] ?? ''}`.trim();
      }
      default: return '';
    }
  }

  toggleApiSelection(api: StepDiscoveredApiView): void {
    if (this.assertionSelections.has(api.id)) {
      this.assertionSelections.delete(api.id);
    } else {
      this.assertionSelections.set(api.id, {
        api,
        expectedStatus: api.responseStatus,
        expectedBodyContains: '',
      });
    }
    this.assertionSelections = new Map(this.assertionSelections);
  }

  isApiSelected(apiId: string): boolean {
    return this.assertionSelections.has(apiId);
  }

  getAssertionConfig(apiId: string) {
    return this.assertionSelections.get(apiId) ?? null;
  }

  updateAssertionStatus(apiId: string, raw: string): void {
    const config = this.assertionSelections.get(apiId);
    if (!config) return;
    config.expectedStatus = raw ? +raw || null : null;
  }

  updateAssertionBody(apiId: string, value: string): void {
    const config = this.assertionSelections.get(apiId);
    if (!config) return;
    config.expectedBodyContains = value;
  }

  private applyReorder(versionId: string, newOrder: StepView[]): void {
    this.versionSteps = newOrder.map((s, i) => ({ ...s, orderIndex: i + 1 }));

    this.stepService
      .reorder(versionId, { stepIds: newOrder.map((s) => s.id) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (steps) => {
          this.versionSteps = steps;
        },
        error: (err: Error) => {
          this.error = this.messageFromError(err, 'Failed to reorder steps');
          this.stepsVersionId = null;
          this.loadStepsForVersion(versionId);
        },
      });
  }

  private stepFormFromView(step: StepView) {
    const meta = step.meta ?? {};
    return {
      action: step.action,
      selector: step.selector ?? '',
      value: step.value ?? '',
      expectedValue: step.expectedValue ?? '',
      timeoutMs: step.timeoutMs,
      optional: step.optional,
      retryCount: step.retryCount,
      metaJson: step.action !== 'ASSERT_API' ? (this.metaString(step.meta) || '{}') : '{}',
      apiUrl: String(meta['url'] ?? ''),
      apiMethod: String(meta['method'] ?? 'GET'),
      apiExpectedStatus: (meta['expectedStatus'] as number | undefined) ?? null,
      apiBodyContains: String(meta['expectedBodyContains'] ?? ''),
    };
  }

  private resetStepForm(): void {
    this.stepForm = {
      action: 'CLICK',
      selector: '',
      value: '',
      expectedValue: '',
      timeoutMs: null,
      optional: false,
      retryCount: 0,
      metaJson: '{}',
      apiUrl: '',
      apiMethod: 'GET',
      apiExpectedStatus: null,
      apiBodyContains: '',
    };
  }

  private buildStepPayload(): StepRequest {
    const f = this.stepForm;
    let extraMeta: Record<string, unknown> | undefined;
    if (f.action !== 'ASSERT_API') {
      try {
        const parsed: unknown = JSON.parse(f.metaJson);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
          extraMeta = parsed as Record<string, unknown>;
        }
      } catch { /* invalid JSON — skip meta */ }
    }
    const base: StepRequest = {
      action: f.action,
      source: 'MANUAL',
      optional: f.optional,
      retryCount: f.retryCount,
      ...(f.timeoutMs != null && { timeoutMs: f.timeoutMs }),
      ...(extraMeta !== undefined && { meta: extraMeta }),
    };
    switch (f.action) {
      case 'CLICK':
        return { ...base, selector: f.selector };
      case 'FILL':
        return { ...base, selector: f.selector, value: f.value };
      case 'NAVIGATE':
        return { ...base, value: f.value };
      case 'WAIT':
        return {
          ...base,
          ...(f.selector && { selector: f.selector }),
          ...(f.value && { value: f.value }),
        };
      case 'ASSERT_TEXT':
        return { ...base, selector: f.selector, expectedValue: f.expectedValue };
      case 'ASSERT_API':
        return {
          ...base,
          meta: {
            url: f.apiUrl,
            method: f.apiMethod,
            ...(f.apiExpectedStatus != null && { expectedStatus: f.apiExpectedStatus }),
            ...(f.apiBodyContains.trim() && { expectedBodyContains: f.apiBodyContains.trim() }),
          },
        };
      default:
        return base;
    }
  }

  openDiscoveryPicker(workflowId: string, version: VersionView): void {
    if (this.discoveringVersionId || version.status !== 'READY') return;

    this.discoveryPickerWorkflowId = workflowId;
    this.discoveryPickerVersion = version;
    this.discoveryPickerSteps = [];
    this.discoveryPickerSelectedIds = new Set();
    this.showDiscoveryPicker = true;

    if (this.stepsVersionId === version.versionId && this.versionSteps.length > 0) {
      this.discoveryPickerSteps = this.versionSteps;
      this.discoveryPickerSelectedIds = new Set(this.versionSteps.map((s) => s.id));
      return;
    }

    this.isLoadingDiscoveryPickerSteps = true;
    this.stepService
      .list(version.versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (steps) => {
          this.discoveryPickerSteps = steps;
          this.discoveryPickerSelectedIds = new Set(steps.map((s) => s.id));
          this.isLoadingDiscoveryPickerSteps = false;
        },
        error: () => {
          this.isLoadingDiscoveryPickerSteps = false;
        },
      });
  }

  closeDiscoveryPicker(): void {
    this.showDiscoveryPicker = false;
    this.discoveryPickerVersion = null;
    this.discoveryPickerSteps = [];
    this.discoveryPickerSelectedIds = new Set();
    this.isLoadingDiscoveryPickerSteps = false;
  }

  toggleDiscoveryStep(stepId: string): void {
    if (this.discoveryPickerSelectedIds.has(stepId)) {
      this.discoveryPickerSelectedIds.delete(stepId);
    } else {
      this.discoveryPickerSelectedIds.add(stepId);
    }
  }

  get allDiscoveryStepsSelected(): boolean {
    return (
      this.discoveryPickerSteps.length > 0 &&
      this.discoveryPickerSteps.every((s) => this.discoveryPickerSelectedIds.has(s.id))
    );
  }

  toggleAllDiscoverySteps(): void {
    if (this.allDiscoveryStepsSelected) {
      this.discoveryPickerSelectedIds = new Set();
    } else {
      this.discoveryPickerSelectedIds = new Set(this.discoveryPickerSteps.map((s) => s.id));
    }
  }

  runDiscovery(): void {
    const version = this.discoveryPickerVersion;
    const workflowId = this.discoveryPickerWorkflowId;
    if (!version || !workflowId || this.discoveryPickerSelectedIds.size === 0) return;

    const allSelected = this.discoveryPickerSelectedIds.size === this.discoveryPickerSteps.length;
    const stepIds = allSelected ? undefined : [...this.discoveryPickerSelectedIds];

    this.closeDiscoveryPicker();
    this.discoverApis(workflowId, version, stepIds);
  }

  discoverApis(workflowId: string, version: VersionView, stepIds?: string[]): void {
    if (this.discoveringVersionId || version.status !== 'READY') {
      return;
    }

    this.discoveringVersionId = version.versionId;
    this.discoveryResults = [];
    this.discoveryVersionId = null;
    this.error = null;

    this.discoveryService
      .discoverApis(workflowId, version.versionId, stepIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => {
          this.discoveringVersionId = null;
          this.discoveryResults = results;
          this.discoveryVersionId = version.versionId;
        },
        error: (err: Error) => {
          this.discoveringVersionId = null;
          this.error = this.messageFromError(err, 'API discovery failed');
        },
      });
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

  selectWorkflowFromEvent(event: Event): void {
    const workflowId = (event.target as HTMLSelectElement).value;
    this.selectWorkflow(workflowId);
  }

  toggleWorkflowTable(): void {
    this.isWorkflowTableOpen = !this.isWorkflowTableOpen;
  }

  versionCountLabel(count: number): string {
    return `${count} ${count === 1 ? 'version' : 'versions'}`;
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return 'Not loaded';
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

  openCreateWorkflow(): void {
    this.showWorkflowForm = true;
    this.workflowSuccess = null;
  }

  openDuplicateWorkflow(workflow: WorkflowResponse): void {
    this.workflowForm.reset({
      name: `${workflow.name} (copy)`,
      description: workflow.description ?? '',
    });
    this.showWorkflowForm = true;
    this.workflowSuccess = null;
  }

  closeCreateWorkflow(): void {
    this.showWorkflowForm = false;
    this.workflowForm.reset({ name: '', description: '' });
  }

  createWorkflow(): void {
    const rawValue = this.workflowForm.getRawValue();
    const name = rawValue.name.trim();
    const description = rawValue.description.trim();

    if (!name) {
      this.workflowForm.controls.name.setErrors({ required: true });
    }

    if (this.workflowForm.invalid) {
      this.workflowForm.markAllAsTouched();
      return;
    }

    const payload: WorkflowUpsertRequest = description ? { name, description } : { name };

    this.workflowSuccess = null;
    this.isCreatingWorkflow = true;

    this.workflowService
      .create(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (workflow) => {
          this.selectedWorkflowId = workflow.id;
          this.loadWorkflows();
          this.setWorkflowSuccess('Workflow created');
          this.isCreatingWorkflow = false;
          this.showWorkflowForm = false;
          this.workflowForm.reset();
        },
        error: () => {
          this.isCreatingWorkflow = false;
        },
      });
  }

  isWorkflowFieldInvalid(fieldName: 'name' | 'description'): boolean {
    const control = this.workflowForm.controls[fieldName];
    return control.invalid && (control.touched || control.dirty);
  }

  isRecordingFieldInvalid(fieldName: 'environmentId' | 'startPath' | 'alias'): boolean {
    const control = this.recordingForm.controls[fieldName];
    return control.invalid && (control.touched || control.dirty);
  }

  startRecording(): void {
    const selectedWorkflow = this.selectedWorkflow;

    if (!selectedWorkflow) {
      this.error = 'Create or select a workflow before recording.';
      return;
    }

    if (this.recordingForm.invalid) {
      this.recordingForm.markAllAsTouched();
      return;
    }

    this.error = null;
    this.workflowSuccess = null;
    this.phase = 'recording';

    this.workflowService
      .startRecording(selectedWorkflow.id, this.recordingPayload())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.workflow?.id) {
            this.replaceWorkflow(response.workflow);
          }
          this.loadWorkflows();
          this.phase = 'recording';
          this.setWorkflowSuccess('Recording started — close the browser when done');
          this.listenForRecordingComplete(selectedWorkflow.id, response.versionId);
        },
        error: (err: Error) => {
          this.phase = 'idle';
          this.error = this.messageFromError(err, 'Failed to start recording');
        },
      });
  }

  recordingPayload(): WorkflowRecordingStartRequest {
    const value = this.recordingForm.getRawValue();
    const startPath = value.startPath.trim();
    const alias = value.alias.trim();

    return {
      environmentId: value.environmentId,
      ...(startPath && { startPath }),
      ...(alias && { alias }),
    };
  }

  replaceWorkflow(updatedWorkflow: WorkflowResponse): void {
    this.workflows = this.workflows.map((workflow) =>
      workflow.id === updatedWorkflow.id ? updatedWorkflow : workflow,
    );
  }

  private listenForRecordingComplete(workflowId: string, versionId: string): void {
    this.closeRecordingEmitter();
    this.recordingEmitter = new EventSource(this.workflowService.recordingStatusUrl(versionId));
    let statusReceived = false;

    this.recordingEmitter.addEventListener('status', (event: MessageEvent) => {
      statusReceived = true;
      const status = event.data as string;
      this.closeRecordingEmitter();
      this.phase = 'idle';
      this.closeRecordingModal();
      this.loadWorkflows();
      if (status === 'READY') {
        this.setWorkflowSuccess('Recording complete — version is ready');
        this.selectedWorkflowId = workflowId;
        this.expandedWorkflowId = workflowId;
        this.pendingVersionSelect = { workflowId, versionId };
        this.loadVersionsForWorkflow(workflowId, 0);
      } else {
        this.error = 'Recording finished with status: ' + status.toLowerCase();
      }
    });

    this.recordingEmitter.onerror = () => {
      if (statusReceived) return;
      this.closeRecordingEmitter();
      this.phase = 'idle';
      this.error = 'Lost connection to recording session';
    };
  }

  private closeRecordingEmitter(): void {
    this.recordingEmitter?.close();
    this.recordingEmitter = null;
  }

  dismissError(): void {
    this.error = null;
  }

  dismissWorkflowSuccess(): void {
    this.workflowSuccess = null;
    this.clearNotificationTimer();
  }

  setWorkflowSuccess(message: string): void {
    this.workflowSuccess = message;
    this.error = null;
    this.clearNotificationTimer();
    this.notificationTimer = setTimeout(() => {
      this.workflowSuccess = null;
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

  relativePathValidator(control: AbstractControl<string>): ValidationErrors | null {
    const value = control.value?.trim();

    if (!value) {
      return null;
    }

    if (value.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(value)) {
      return { relativePath: true };
    }

    return null;
  }

  messageFromError(error: Error, fallback: string): string {
    return error.message || fallback;
  }
}
