import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import type { ApiErrorResponse } from '../../auth/models/auth.model';
import type { EnvironmentResponse } from '../environments/models/environment.model';
import { EnvironmentService } from '../environments/services/environment.service';
import { WorkflowEditorComponent } from './record/components/workflow-editor/workflow-editor.component';
import type { RecordingPhase } from './record/models/record-contract.model';
import { RecordWorkflowParserService } from './record/services/record-workflow-parser.service';
import type {
  WorkflowListItemResponse,
  WorkflowRecordingStartRequest,
  WorkflowRequest,
  WorkflowResponse,
} from './models/workflow.model';
import { WorkflowService } from './services/workflow.service';

interface WorkflowListItem {
  readonly id: string;
  readonly versionId: string | null;
  readonly versionNumber: number;
  readonly name: string;
  readonly description: string;
  readonly versionStatus: string;
  readonly stepCount: number | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
}

@Component({
  selector: 'app-workflows',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, WorkflowEditorComponent],
  templateUrl: './workflows.component.html',
  styleUrl: './workflows.component.scss',
})
export class WorkflowsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  phase: RecordingPhase = 'idle';
  generatedScript: string | null = null;
  error: string | null = null;
  workflowError: string | null = null;
  workflowSuccess: string | null = null;
  showWorkflowForm = false;
  isCreatingWorkflow = false;
  isLoadingEnvironments = false;
  isLoadingWorkflows = false;
  selectedWorkflowId = '';

  protected workflows: WorkflowListItem[] = [];
  protected recordingEnvironments: EnvironmentResponse[] = [];

  protected readonly workflowForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.maxLength(2000)]],
  });
  protected readonly recordingForm = this.formBuilder.nonNullable.group({
    environmentId: ['', [Validators.required]],
    startPath: ['', [Validators.maxLength(1000), this.relativePathValidator]],
  });

  ngOnInit(): void {
    this.loadWorkflows();
    this.loadRecordingEnvironments();
  }

  get workflowSteps() {
    return this.workflowParser.parse(this.generatedScript);
  }

  protected get selectedWorkflow(): WorkflowListItem | null {
    return this.workflows.find((workflow) => workflow.id === this.selectedWorkflowId) ?? null;
  }

  protected get metrics() {
    const recording = this.workflows.filter((workflow) =>
      this.isRecordingStatus(workflow.versionStatus),
    ).length;
    const versions = this.workflows.reduce((total, workflow) => total + workflow.versionNumber, 0);
    const selected = this.selectedWorkflow ? 1 : 0;

    return [
      { label: 'Workflows', value: this.workflows.length.toString() },
      { label: 'Recording', value: recording.toString() },
      { label: 'Versions', value: versions.toString() },
      { label: 'Selected', value: selected.toString() },
    ];
  }

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly workflowParser: RecordWorkflowParserService,
    private readonly workflowService: WorkflowService,
  ) {}

  protected loadWorkflows(): void {
    this.isLoadingWorkflows = true;

    this.workflowService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.workflows = response.data.map((workflow) => this.toWorkflowListItemFromList(workflow));

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
        error: (err: HttpErrorResponse) => {
          this.error = this.messageFromError(err, 'Failed to load workflows');
          this.isLoadingWorkflows = false;
        },
      });
  }

  protected loadRecordingEnvironments(): void {
    this.isLoadingEnvironments = true;

    this.environmentService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.recordingEnvironments = response.data;

          if (!this.recordingForm.controls.environmentId.value && response.data.length) {
            this.recordingForm.controls.environmentId.setValue(response.data[0].id);
          }

          if (
            this.recordingForm.controls.environmentId.value &&
            !response.data.some(
              (environment) => environment.id === this.recordingForm.controls.environmentId.value,
            )
          ) {
            this.recordingForm.controls.environmentId.setValue(response.data[0]?.id ?? '');
          }

          this.isLoadingEnvironments = false;
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.messageFromError(err, 'Failed to load environments');
          this.isLoadingEnvironments = false;
        },
      });
  }

  protected selectWorkflow(workflowId: string): void {
    this.selectedWorkflowId = workflowId;
    this.error = null;
  }

  protected openCreateWorkflow(): void {
    this.showWorkflowForm = true;
    this.workflowError = null;
    this.workflowSuccess = null;
  }

  protected closeCreateWorkflow(): void {
    this.showWorkflowForm = false;
    this.workflowForm.reset({ name: '', description: '' });
  }

  protected createWorkflow(): void {
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

    const payload: WorkflowRequest = description ? { name, description } : { name };

    this.workflowError = null;
    this.workflowSuccess = null;
    this.isCreatingWorkflow = true;

    this.workflowService
      .create(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.upsertWorkflow(response.data, { name, description: description || 'No description' });
          this.workflowSuccess = response.message;
          this.isCreatingWorkflow = false;
          this.showWorkflowForm = false;
          this.workflowForm.reset({ name: '', description: '' });
        },
        error: (err: HttpErrorResponse) => {
          this.workflowError = this.messageFromError(err, 'Failed to create workflow');
          this.isCreatingWorkflow = false;
        },
      });
  }

  protected isWorkflowFieldInvalid(fieldName: 'name' | 'description'): boolean {
    const control = this.workflowForm.controls[fieldName];
    return control.invalid && (control.touched || control.dirty);
  }

  protected isRecordingFieldInvalid(fieldName: 'environmentId' | 'startPath'): boolean {
    const control = this.recordingForm.controls[fieldName];
    return control.invalid && (control.touched || control.dirty);
  }

  protected startRecording(): void {
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
    this.generatedScript = null;
    this.phase = 'recording';

    this.workflowService
      .startRecording(selectedWorkflow.id, this.recordingPayload())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.upsertWorkflow(response.data);
          this.phase = this.isRecordingStatus(response.data.versionStatus) ? 'recording' : 'idle';
          this.workflowSuccess = response.message;
        },
        error: (err: unknown) => {
          this.phase = 'idle';
          this.error = this.messageFromError(err, 'Failed to start recording');
        },
      });
  }

  protected statusLabel(status: string): string {
    return status
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  protected statusToken(status: string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  private recordingPayload(): WorkflowRecordingStartRequest {
    const value = this.recordingForm.getRawValue();
    const startPath = value.startPath.trim();

    return startPath
      ? { environmentId: value.environmentId, startPath }
      : { environmentId: value.environmentId };
  }

  private upsertWorkflow(
    response: WorkflowResponse,
    metadata: Pick<WorkflowListItem, 'name' | 'description'> | null = null,
  ): void {
    const workflow = this.toWorkflowListItem(response, metadata);

    this.workflows = this.workflows.some((item) => item.id === workflow.id)
      ? this.workflows.map((item) => (item.id === workflow.id ? workflow : item))
      : [workflow, ...this.workflows];

    this.selectedWorkflowId = workflow.id;
  }

  private toWorkflowListItem(
    response: WorkflowResponse,
    metadata: Pick<WorkflowListItem, 'name' | 'description'> | null,
  ): WorkflowListItem {
    const existingWorkflow = this.workflows.find((workflow) => workflow.id === response.workflowId);

    return {
      id: response.workflowId,
      versionId: response.workflowVersionId,
      versionNumber: response.versionNumber,
      name: metadata?.name ?? existingWorkflow?.name ?? 'Untitled workflow',
      description: metadata?.description ?? existingWorkflow?.description ?? 'No description',
      versionStatus: response.versionStatus,
      stepCount: response.stepCount,
      createdAt: existingWorkflow?.createdAt ?? null,
      updatedAt: existingWorkflow?.updatedAt ?? null,
    };
  }

  private toWorkflowListItemFromList(response: WorkflowListItemResponse): WorkflowListItem {
    return {
      id: response.workflowId,
      versionId: null,
      versionNumber: response.currentVersion,
      name: response.name,
      description: response.description?.trim() || 'No description',
      versionStatus: response.currentVersionStatus,
      stepCount: null,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };
  }

  private isRecordingStatus(status: string): boolean {
    return status.toLowerCase() === 'recording';
  }

  private relativePathValidator(control: AbstractControl<string>): ValidationErrors | null {
    const value = control.value?.trim();

    if (!value) {
      return null;
    }

    if (value.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(value)) {
      return { relativePath: true };
    }

    return null;
  }

  private messageFromError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      return this.messageFromPayload(error.error, fallback);
    }

    return this.messageFromPayload(error, fallback);
  }

  private messageFromPayload(payload: unknown, fallback: string): string {
    if (typeof payload === 'string') {
      return payload;
    }

    if (!payload || typeof payload !== 'object') {
      return fallback;
    }

    const apiPayload = payload as Partial<ApiErrorResponse> & {
      error?: unknown;
      message?: unknown;
    };

    if (typeof apiPayload.message === 'string') {
      return apiPayload.message;
    }

    if (typeof apiPayload.error === 'string') {
      return apiPayload.error;
    }

    if (apiPayload.error && typeof apiPayload.error === 'object') {
      const nestedPayload = apiPayload.error as { message?: unknown; error?: unknown };

      if (typeof nestedPayload.message === 'string') {
        return nestedPayload.message;
      }

      if (typeof nestedPayload.error === 'string') {
        return nestedPayload.error;
      }
    }

    return fallback;
  }
}
