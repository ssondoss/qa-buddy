import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import type { ApiErrorResponse } from '../auth/models/auth.model';
import { WorkflowEditorComponent } from '../record/components/workflow-editor/workflow-editor.component';
import type { RecordingPhase } from '../record/models/record-contract.model';
import { RecordWorkflowParserService } from '../record/services/record-workflow-parser.service';
import { RecordService } from '../record/services/record.service';
import type { WorkflowRequest, WorkflowResponse } from './models/workflow.model';
import { WorkflowService } from './services/workflow.service';

type WorkflowStatus = 'Active' | 'Draft' | 'Review';

interface WorkflowListItem {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly owner: string;
  readonly environment: string;
  readonly status: WorkflowStatus;
  readonly stepCount: number;
  readonly lastRun: string;
  readonly schedule: string;
}

@Component({
  selector: 'app-workflows',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, WorkflowEditorComponent],
  templateUrl: './workflows.component.html',
  styleUrl: './workflows.component.scss',
})
export class WorkflowsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  url = '';
  phase: RecordingPhase = 'idle';
  generatedScript: string | null = null;
  error: string | null = null;
  workflowError: string | null = null;
  workflowSuccess: string | null = null;
  showWorkflowForm = false;
  isCreatingWorkflow = false;
  selectedWorkflowId = 'checkout-smoke';

  protected workflows: WorkflowListItem[] = [
    {
      id: 'checkout-smoke',
      name: 'Checkout Smoke',
      description: 'Critical checkout journey for smoke coverage.',
      owner: 'QA Team',
      environment: 'Staging',
      status: 'Active',
      stepCount: 18,
      lastRun: '2026-04-24 16:30',
      schedule: 'Hourly',
    },
    {
      id: 'user-onboarding',
      name: 'User Onboarding',
      description: 'Account creation and first-session checks.',
      owner: 'SDET',
      environment: 'QA',
      status: 'Review',
      stepCount: 24,
      lastRun: '2026-04-24 14:12',
      schedule: 'Daily',
    },
    {
      id: 'admin-permissions',
      name: 'Admin Permissions',
      description: 'Role and permission verification for admins.',
      owner: 'Engineering',
      environment: 'QA',
      status: 'Draft',
      stepCount: 11,
      lastRun: '2026-04-23 18:45',
      schedule: 'Manual',
    },
  ];

  protected readonly workflowForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.maxLength(2000)]],
  });

  get workflowSteps() {
    return this.workflowParser.parse(this.generatedScript);
  }

  protected get selectedWorkflow(): WorkflowListItem | null {
    return this.workflows.find((workflow) => workflow.id === this.selectedWorkflowId) ?? null;
  }

  protected get metrics() {
    const active = this.workflows.filter((workflow) => workflow.status === 'Active').length;
    const draft = this.workflows.filter((workflow) => workflow.status === 'Draft').length;
    const steps = this.workflows.reduce((total, workflow) => total + workflow.stepCount, 0);

    return [
      { label: 'Workflows', value: this.workflows.length.toString() },
      { label: 'Active', value: active.toString() },
      { label: 'Draft', value: draft.toString() },
      { label: 'Steps', value: steps.toString() },
    ];
  }

  constructor(
    private readonly recordService: RecordService,
    private readonly workflowParser: RecordWorkflowParserService,
    private readonly workflowService: WorkflowService,
  ) {}

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
          const workflow = this.toWorkflowListItem(response.data);
          this.workflows = [workflow, ...this.workflows];
          this.selectedWorkflowId = workflow.id;
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

  open(): void {
    const selectedWorkflow = this.selectedWorkflow;

    if (!selectedWorkflow) {
      this.error = 'Create or select a workflow before recording.';
      return;
    }

    this.error = null;
    this.generatedScript = null;

    this.recordService
      .open({ url: this.url, workflowId: selectedWorkflow.id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.phase = status.phase;

          if (status.phase === 'idle' && status.hasResult) {
            this.recordService
              .getResult()
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (res) => {
                  this.generatedScript = res.content;
                },
                error: (err: unknown) =>
                  (this.error = this.messageFromError(err, 'Failed to fetch result')),
              });
          }
        },
        error: (err: unknown) =>
          (this.error = this.messageFromError(err, 'Failed to open browser')),
      });
  }

  private toWorkflowListItem(response: WorkflowResponse): WorkflowListItem {
    return {
      id: String(response.id ?? `workflow-${Date.now()}`),
      name: response.name,
      description: response.description?.trim() || 'No description',
      owner: response.owner?.trim() || 'You',
      environment: response.environment?.trim() || 'Default',
      status: this.toWorkflowStatus(response.status),
      stepCount: response.stepCount ?? 0,
      lastRun: this.formatWorkflowDate(response.lastRun),
      schedule: response.schedule?.trim() || 'Manual',
    };
  }

  private toWorkflowStatus(status: string | null | undefined): WorkflowStatus {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'Active';
      case 'review':
        return 'Review';
      default:
        return 'Draft';
    }
  }

  private formatWorkflowDate(value: string | null | undefined): string {
    if (!value) {
      return 'Never';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const pad = (part: number) => part.toString().padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
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
