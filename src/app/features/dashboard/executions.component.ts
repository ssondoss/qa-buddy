import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ExecutionService } from './executions/services/execution.service';
import type { ExecutionStatus, ExecutionView } from './executions/models/execution.model';
import { WorkflowService } from './workflows/services/workflow.service';
import type { WorkflowResponse, VersionView } from './workflows/models/workflow.model';

@Component({
  selector: 'app-executions',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './executions.component.html',
  styleUrl: './executions.component.scss',
})
export class ExecutionsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly executionService = inject(ExecutionService);
  private readonly workflowService = inject(WorkflowService);
  private readonly route = inject(ActivatedRoute);

  workflows: WorkflowResponse[] = [];
  versions: VersionView[] = [];
  executions: ExecutionView[] = [];

  selectedWorkflowId = '';
  selectedVersionId = '';

  isLoadingWorkflows = false;
  isLoadingExecutions = false;
  error: string | null = null;

  page = 0;
  readonly pageSize = 20;
  expandedExecutionId: string | null = null;
  refreshMessage: string | null = null;

  private isRefreshing = false;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  get filteredExecutions(): ExecutionView[] {
    if (!this.selectedVersionId) return this.executions;
    return this.executions.filter((e) => e.versionId === this.selectedVersionId);
  }

  get pagedExecutions(): ExecutionView[] {
    const start = this.page * this.pageSize;
    return this.filteredExecutions.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredExecutions.length / this.pageSize));
  }

  get runningExecutions(): ExecutionView[] {
    return this.filteredExecutions.filter((e) => e.status === 'RUNNING');
  }

  get failedCount(): number {
    return this.filteredExecutions.filter((e) => e.status === 'FAILED').length;
  }

  get passedCount(): number {
    return this.filteredExecutions.filter((e) => e.status === 'PASSED').length;
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const workflowId = params.get('workflowId') ?? '';
    const versionId = params.get('versionId') ?? '';
    this.loadWorkflows(workflowId, versionId);
  }

  onWorkflowChange(workflowId: string): void {
    this.selectedVersionId = '';
    this.versions = [];
    this.executions = [];
    this.page = 0;
    this.error = null;
    if (workflowId) {
      this.loadExecutions(workflowId);
      this.loadVersions(workflowId);
    }
  }

  onVersionChange(): void {
    this.page = 0;
    this.expandedExecutionId = null;
  }

  clearFilters(): void {
    this.selectedVersionId = '';
    this.page = 0;
    this.expandedExecutionId = null;
  }

  refresh(): void {
    if (this.selectedWorkflowId) {
      this.isRefreshing = true;
      this.loadExecutions(this.selectedWorkflowId);
    }
  }

  toggleExecution(id: string): void {
    this.expandedExecutionId = this.expandedExecutionId === id ? null : id;
  }

  goToPage(p: number): void {
    if (p < 0 || p >= this.totalPages) return;
    this.page = p;
    this.expandedExecutionId = null;
  }

  statusToken(status: ExecutionStatus | string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  statusLabel(status: ExecutionStatus | string): string {
    return status
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
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

  avgDuration(): string {
    const finished = this.filteredExecutions.filter((e) => e.finishedAt);
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

  stepSnapshot(step: ExecutionView['stepResults'][number], key: string): string {
    const val = step.stepSnapshot?.[key];
    return typeof val === 'string' ? val : '';
  }

  private loadWorkflows(preferWorkflowId = '', preferVersionId = ''): void {
    this.isLoadingWorkflows = true;
    this.workflowService
      .list(0, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.workflows = response.items;
          this.isLoadingWorkflows = false;
          const targetId =
            preferWorkflowId && response.items.some((w) => w.id === preferWorkflowId)
              ? preferWorkflowId
              : response.items[0]?.id ?? '';
          if (targetId) {
            this.selectedWorkflowId = targetId;
            this.loadExecutions(targetId, preferVersionId);
            this.loadVersions(targetId, preferVersionId);
          }
        },
        error: (err: Error) => {
          this.error = err.message || 'Failed to load workflows';
          this.isLoadingWorkflows = false;
        },
      });
  }

  private loadVersions(workflowId: string, preferVersionId = ''): void {
    this.workflowService
      .versions(workflowId, 0, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.versions = response.items;
          if (preferVersionId && response.items.some((v) => v.versionId === preferVersionId)) {
            this.selectedVersionId = preferVersionId;
          }
        },
        error: () => {
          this.versions = [];
        },
      });
  }

  private loadExecutions(workflowId: string, preferVersionId = ''): void {
    this.isLoadingExecutions = true;
    const previousCount = this.isRefreshing ? this.executions.length : -1;
    this.executions = [];
    this.executionService
      .listByWorkflow(workflowId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (executions) => {
          this.executions = executions;
          this.isLoadingExecutions = false;
          if (preferVersionId && executions.some((e) => e.versionId === preferVersionId)) {
            this.selectedVersionId = preferVersionId;
          }
          if (this.isRefreshing) {
            this.isRefreshing = false;
            const delta = executions.length - previousCount;
            this.refreshMessage = delta > 0 ? `+${delta} new execution${delta === 1 ? '' : 's'}` : 'Up to date';
            if (this.refreshTimer) clearTimeout(this.refreshTimer);
            this.refreshTimer = setTimeout(() => { this.refreshMessage = null; }, 2500);
          }
        },
        error: (err: Error) => {
          this.error = err.message || 'Failed to load executions';
          this.isLoadingExecutions = false;
          this.isRefreshing = false;
        },
      });
  }
}
