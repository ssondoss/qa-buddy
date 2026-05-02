import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { EnvironmentResponse } from '../environments/models/environment.model';
import { EnvironmentService } from '../environments/services/environment.service';
import type { RecordingPhase } from './record/models/record-contract.model';
import type {
  WorkflowRecordingStartRequest,
  WorkflowResponse,
  WorkflowUpsertRequest,
} from './models/workflow.model';
import { WorkflowService } from './services/workflow.service';

@Component({
  selector: 'app-workflows',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
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
  isCreatingWorkflow = false;
  isLoadingEnvironments = false;
  isLoadingWorkflows = false;
  isWorkflowTableOpen = true;
  selectedWorkflowId = '';

  workflows: WorkflowResponse[] = [];
  recordingEnvironments: EnvironmentResponse[] = [];

  readonly workflowForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.maxLength(2000)]],
  });
  readonly recordingForm = this.formBuilder.nonNullable.group({
    environmentId: ['', [Validators.required]],
    startPath: ['', [Validators.maxLength(1000), this.relativePathValidator]],
  });

  constructor(
    readonly environmentService: EnvironmentService,
    readonly workflowService: WorkflowService,
  ) {
    this.destroyRef.onDestroy(() => this.clearNotificationTimer());
  }

  ngOnInit(): void {
    this.loadWorkflows();
    this.loadRecordingEnvironments();
  }

  get selectedWorkflow(): WorkflowResponse | null {
    return this.workflows.find((workflow) => workflow.id === this.selectedWorkflowId) ?? null;
  }

  loadWorkflows(): void {
    this.isLoadingWorkflows = true;

    this.workflowService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.workflows = response;

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
        error: (err: Error) => {
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
        error: (err: Error) => {
          this.isLoadingEnvironments = false;
        },
      });
  }

  selectWorkflow(workflowId: string): void {
    this.selectedWorkflowId = workflowId;
    this.error = null;
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

  isRecordingFieldInvalid(fieldName: 'environmentId' | 'startPath'): boolean {
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
        next: (workflow) => {
          if (workflow?.id) {
            this.replaceWorkflow(workflow);
          }
          this.loadWorkflows();
          this.phase = 'recording';
          this.setWorkflowSuccess('Recording started');
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

    return startPath
      ? { environmentId: value.environmentId, startPath }
      : { environmentId: value.environmentId };
  }

  replaceWorkflow(updatedWorkflow: WorkflowResponse): void {
    this.workflows = this.workflows.map((workflow) =>
      workflow.id === updatedWorkflow.id ? updatedWorkflow : workflow,
    );
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
