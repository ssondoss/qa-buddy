import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ExecutionService } from './executions/services/execution.service';
import type { ExecutionStatus, ExecutionView } from './executions/models/execution.model';
import { WorkflowService } from './workflows/services/workflow.service';
import type { WorkflowResponse } from './workflows/models/workflow.model';

@Component({
  selector: 'app-executions',
  standalone: true,
  templateUrl: './executions.component.html',
  styleUrl: './executions.component.scss',
})
export class ExecutionsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly executionService = inject(ExecutionService);
  private readonly workflowService = inject(WorkflowService);

  workflows: WorkflowResponse[] = [];
  executions: ExecutionView[] = [];
  selectedWorkflowId = '';
  isLoadingWorkflows = false;
  isLoadingExecutions = false;
  error: string | null = null;

  ngOnInit(): void {
    this.loadWorkflows();
  }

  get runningExecutions(): ExecutionView[] {
    return this.executions.filter((e) => e.status === 'RUNNING');
  }

  get metrics() {
    const total = this.executions.length;
    const running = this.runningExecutions.length;
    const failed = this.executions.filter((e) => e.status === 'FAILED').length;
    return [
      { label: 'Total', value: total.toString() },
      { label: 'Running', value: running.toString() },
      { label: 'Failed', value: failed.toString() },
      { label: 'Avg Duration', value: this.avgDuration() },
    ];
  }

  onWorkflowSelect(event: Event): void {
    const workflowId = (event.target as HTMLSelectElement).value;
    this.selectedWorkflowId = workflowId;
    this.executions = [];
    this.error = null;

    if (workflowId) {
      this.loadExecutions(workflowId);
    }
  }

  statusToken(status: ExecutionStatus): string {
    return status.toLowerCase().replace('_', '-');
  }

  statusLabel(status: ExecutionStatus): string {
    return status
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      date,
    );
  }

  formatDuration(startedAt: string, finishedAt: string | null): string {
    if (!finishedAt) return '—';
    const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  shortId(id: string): string {
    return id.slice(0, 8).toUpperCase();
  }

  private loadWorkflows(): void {
    this.isLoadingWorkflows = true;
    this.workflowService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (workflows) => {
          this.workflows = workflows;
          this.isLoadingWorkflows = false;
          if (workflows.length) {
            this.selectedWorkflowId = workflows[0].id;
            this.loadExecutions(workflows[0].id);
          }
        },
        error: (err: Error) => {
          this.error = err.message || 'Failed to load workflows';
          this.isLoadingWorkflows = false;
        },
      });
  }

  private loadExecutions(workflowId: string): void {
    this.isLoadingExecutions = true;
    this.executionService
      .listByWorkflow(workflowId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (executions) => {
          this.executions = executions;
          this.isLoadingExecutions = false;
        },
        error: (err: Error) => {
          this.error = err.message || 'Failed to load executions';
          this.isLoadingExecutions = false;
        },
      });
  }

  private avgDuration(): string {
    const finished = this.executions.filter((e) => e.finishedAt);
    if (!finished.length) return '—';
    const avgMs =
      finished.reduce(
        (sum, e) => sum + (new Date(e.finishedAt!).getTime() - new Date(e.startedAt).getTime()),
        0,
      ) / finished.length;
    const totalSeconds = Math.floor(avgMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}