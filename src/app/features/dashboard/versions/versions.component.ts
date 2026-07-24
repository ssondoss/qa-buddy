import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type { StepView } from '../workflows/steps/models/step.model';
import { StepService } from '../workflows/steps/services/step.service';
import { DiscoveryService } from '../workflows/steps/services/discovery.service';
import type { StepApiDiscoveryResult, StepDiscoveredApiView } from '../workflows/steps/models/discovered-api.model';
import type {
  VersionAliasUpdateRequest,
  VersionView,
  WorkflowRecordingStartRequest,
  WorkflowResponse,
} from '../workflows/models/workflow.model';
import { WorkflowService } from '../workflows/services/workflow.service';
import { ExecutionService } from '../executions/services/execution.service';
import { EnvironmentService } from '../environments/services/environment.service';
import type { EnvironmentResponse } from '../environments/models/environment.model';

@Component({
  selector: 'app-versions',
  standalone: true,
  imports: [],
  templateUrl: './versions.component.html',
  styleUrl: './versions.component.scss',
})
export class VersionsComponent implements OnInit {
  readonly destroyRef = inject(DestroyRef);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);

  workflows: WorkflowResponse[] = [];
  versions: VersionView[] = [];
  selectedWorkflowId = '';
  isLoadingWorkflows = false;
  isLoadingVersions = false;
  error: string | null = null;
  success: string | null = null;
  private notificationTimer: ReturnType<typeof setTimeout> | null = null;

  expandedVersionId: string | null = null;
  stepsMap: Record<string, StepView[]> = {};
  stepsLoadingMap: Record<string, boolean> = {};

  executingVersionId: string | null = null;

  editingAliasVersionId: string | null = null;
  aliasInputValue = '';
  isSavingAlias = false;

  environments: EnvironmentResponse[] = [];
  isLoadingEnvironments = false;
  showRecordPanel = false;
  recordEnvId = '';
  recordAlias = '';
  recordPath = '';
  isStartingRecording = false;

  confirmingDeleteVersionId: string | null = null;
  isDeletingVersion = false;
  duplicatingVersionId: string | null = null;

  // ── Discovery ──────────────────────────────────────────────────────────────
  discoveringVersionId: string | null = null;
  discoveryResults: StepApiDiscoveryResult[] = [];
  discoveryVersionId: string | null = null;

  showDiscoveryPicker = false;
  discoveryPickerVersion: VersionView | null = null;
  discoveryPickerSteps: StepView[] = [];
  discoveryPickerSelectedIds = new Set<string>();
  isLoadingDiscoveryPickerSteps = false;

  private routeWorkflowId = '';

  constructor(
    readonly stepService: StepService,
    readonly workflowService: WorkflowService,
    readonly executionService: ExecutionService,
    readonly environmentService: EnvironmentService,
    readonly discoveryService: DiscoveryService,
  ) {
    this.destroyRef.onDestroy(() => this.clearNotificationTimer());
  }

  ngOnInit(): void {
    this.routeWorkflowId = this.route.snapshot.queryParamMap.get('workflowId') ?? '';
    this.loadWorkflows();
    this.loadEnvironments();
  }

  get selectedWorkflow(): WorkflowResponse | null {
    return this.workflows.find((w) => w.id === this.selectedWorkflowId) ?? null;
  }

  // ── Workflows ──────────────────────────────────────────────────────────────

  loadWorkflows(): void {
    this.isLoadingWorkflows = true;
    this.workflowService
      .list(0, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.workflows = response.items;
          this.selectedWorkflowId = this.resolveWorkflowId();
          this.isLoadingWorkflows = false;
          if (this.selectedWorkflowId) {
            this.loadVersions();
          }
        },
        error: (err: Error) => {
          this.error = this.messageFromError(err, 'Failed to load workflows');
          this.isLoadingWorkflows = false;
        },
      });
  }

  loadEnvironments(): void {
    this.isLoadingEnvironments = true;
    this.environmentService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (envs) => {
          this.environments = envs;
          this.isLoadingEnvironments = false;
        },
        error: () => {
          this.isLoadingEnvironments = false;
        },
      });
  }

  selectWorkflow(workflowId: string): void {
    this.selectedWorkflowId = workflowId;
    this.versions = [];
    this.expandedVersionId = null;
    this.stepsMap = {};
    this.stepsLoadingMap = {};
    this.error = null;
    this.success = null;
    this.showRecordPanel = false;
    this.confirmingDeleteVersionId = null;
    this.duplicatingVersionId = null;
    this.resetDiscovery();
    this.updateUrl();
    this.loadVersions();
  }

  selectWorkflowFromEvent(event: Event): void {
    const workflowId = (event.target as HTMLSelectElement).value;
    if (workflowId) this.selectWorkflow(workflowId);
  }

  loadVersions(): void {
    if (!this.selectedWorkflow) return;
    this.isLoadingVersions = true;
    this.versions = [];
    this.expandedVersionId = null;
    this.stepsMap = {};
    this.stepsLoadingMap = {};
    this.confirmingDeleteVersionId = null;
    this.resetDiscovery();

    this.workflowService
      .versions(this.selectedWorkflowId, 0, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.versions = response.items;
          this.isLoadingVersions = false;
        },
        error: (err: Error) => {
          this.error = this.messageFromError(err, 'Failed to load versions');
          this.isLoadingVersions = false;
        },
      });
  }

  // ── Version row / steps ────────────────────────────────────────────────────

  selectVersionRow(version: VersionView): void {
    if (this.expandedVersionId === version.versionId) {
      this.expandedVersionId = null;
      return;
    }
    this.expandedVersionId = version.versionId;

    if (!this.stepsMap[version.versionId]) {
      this.loadStepsForVersion(version.versionId);
    }

    if (version.status === 'READY') {
      this.discoveryService
        .getDiscoveredApis(this.selectedWorkflowId, version.versionId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (results) => {
            if (results.some((r) => r.apis.length > 0)) {
              this.discoveryResults = results;
              this.discoveryVersionId = version.versionId;
            }
          },
          error: () => {},
        });
    }
  }

  loadStepsForVersion(versionId: string): void {
    this.stepsLoadingMap = { ...this.stepsLoadingMap, [versionId]: true };
    this.stepService
      .list(versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (steps) => {
          this.stepsMap = { ...this.stepsMap, [versionId]: steps };
          this.stepsLoadingMap = { ...this.stepsLoadingMap, [versionId]: false };
        },
        error: () => {
          this.stepsMap = { ...this.stepsMap, [versionId]: [] };
          this.stepsLoadingMap = { ...this.stepsLoadingMap, [versionId]: false };
        },
      });
  }

  // ── Recording ──────────────────────────────────────────────────────────────

  openRecordPanel(): void {
    this.showRecordPanel = true;
    this.recordEnvId = this.environments[0]?.id ?? '';
    this.recordAlias = '';
    this.recordPath = '';
  }

  cancelRecordPanel(): void {
    this.showRecordPanel = false;
    this.recordEnvId = '';
    this.recordAlias = '';
    this.recordPath = '';
  }

  startRecording(): void {
    if (!this.selectedWorkflowId || !this.recordEnvId || this.isStartingRecording) return;
    this.isStartingRecording = true;
    const payload: WorkflowRecordingStartRequest = {
      environmentId: this.recordEnvId,
      alias: this.recordAlias.trim() || undefined,
      startPath: this.recordPath.trim() || undefined,
    };
    this.workflowService
      .startRecording(this.selectedWorkflowId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isStartingRecording = false;
          this.cancelRecordPanel();
          this.setSuccess('Recording started — close the browser when done');
          this.loadVersions();
        },
        error: (err: Error) => {
          this.isStartingRecording = false;
          this.error = this.messageFromError(err, 'Failed to start recording');
        },
      });
  }

  // ── Duplicate ──────────────────────────────────────────────────────────────

  duplicateVersion(event: Event, version: VersionView): void {
    event.stopPropagation();
    if (this.duplicatingVersionId) return;
    this.duplicatingVersionId = version.versionId;
    this.workflowService
      .duplicateVersion(this.selectedWorkflowId, version.versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.duplicatingVersionId = null;
          this.setSuccess(`v${version.versionNumber} duplicated`);
          this.loadVersions();
        },
        error: (err: Error) => {
          this.duplicatingVersionId = null;
          this.error = this.messageFromError(err, 'Failed to duplicate version');
        },
      });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  requestDeleteVersion(event: Event, versionId: string): void {
    event.stopPropagation();
    this.confirmingDeleteVersionId = versionId;
  }

  cancelDeleteVersion(): void {
    this.confirmingDeleteVersionId = null;
  }

  confirmDeleteVersion(version: VersionView): void {
    if (this.isDeletingVersion) return;
    this.isDeletingVersion = true;
    this.workflowService
      .deleteVersion(this.selectedWorkflowId, version.versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isDeletingVersion = false;
          this.confirmingDeleteVersionId = null;
          if (this.expandedVersionId === version.versionId) {
            this.expandedVersionId = null;
          }
          this.setSuccess(`v${version.versionNumber} deleted`);
          this.loadVersions();
        },
        error: (err: Error) => {
          this.isDeletingVersion = false;
          this.error = this.messageFromError(err, 'Failed to delete version');
        },
      });
  }

  // ── Execute ────────────────────────────────────────────────────────────────

  executeVersion(event: Event, version: VersionView): void {
    event.stopPropagation();
    if (this.executingVersionId || version.status !== 'READY') return;
    this.executingVersionId = version.versionId;
    this.error = null;
    this.executionService
      .execute(this.selectedWorkflowId, version.versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.executingVersionId = null;
          if (result.status === 'PASSED') {
            this.setSuccess(`Execution passed — v${version.versionNumber}`);
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

  navigateToVersionExecutions(event: Event, versionId: string): void {
    event.stopPropagation();
    this.router.navigate(['/dashboard/executions'], {
      queryParams: { workflowId: this.selectedWorkflowId, versionId },
    });
  }

  // ── Discovery ──────────────────────────────────────────────────────────────

  openDiscoveryPicker(event: Event, version: VersionView): void {
    event.stopPropagation();
    if (this.discoveringVersionId || version.status !== 'READY') return;

    this.discoveryPickerVersion = version;
    this.discoveryPickerSteps = [];
    this.discoveryPickerSelectedIds = new Set();
    this.showDiscoveryPicker = true;

    const cached = this.stepsMap[version.versionId];
    if (cached?.length) {
      this.discoveryPickerSteps = cached;
      this.discoveryPickerSelectedIds = new Set(cached.map((s) => s.id));
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
    this.discoveryPickerSelectedIds = new Set(this.discoveryPickerSelectedIds);
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
    if (!version || this.discoveryPickerSelectedIds.size === 0) return;
    const allSelected = this.discoveryPickerSelectedIds.size === this.discoveryPickerSteps.length;
    const stepIds = allSelected ? undefined : [...this.discoveryPickerSelectedIds];
    this.closeDiscoveryPicker();
    this.discoverApis(version, stepIds);
  }

  discoverApis(version: VersionView, stepIds?: string[]): void {
    if (this.discoveringVersionId || version.status !== 'READY') return;
    this.discoveringVersionId = version.versionId;
    this.discoveryResults = [];
    this.discoveryVersionId = null;
    this.error = null;

    this.discoveryService
      .discoverApis(this.selectedWorkflowId, version.versionId, stepIds)
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

  discoveredApisForStep(stepId: string): StepDiscoveredApiView[] {
    return this.discoveryResults.find((r) => r.stepId === stepId)?.apis ?? [];
  }

  navigateToStepApis(event: Event, stepId: string, versionId: string): void {
    event.stopPropagation();
    this.router.navigate(['/dashboard/discovered-apis'], {
      queryParams: {
        workflowId: this.selectedWorkflowId || undefined,
        versionId,
        stepId,
      },
    });
  }

  private resetDiscovery(): void {
    this.discoveringVersionId = null;
    this.discoveryResults = [];
    this.discoveryVersionId = null;
    this.showDiscoveryPicker = false;
    this.discoveryPickerVersion = null;
    this.discoveryPickerSteps = [];
    this.discoveryPickerSelectedIds = new Set();
    this.isLoadingDiscoveryPickerSteps = false;
  }

  // ── Alias ──────────────────────────────────────────────────────────────────

  openAliasEditor(event: Event, version: VersionView): void {
    event.stopPropagation();
    this.editingAliasVersionId = version.versionId;
    this.aliasInputValue = version.alias ?? '';
  }

  cancelAliasEditor(): void {
    this.editingAliasVersionId = null;
    this.aliasInputValue = '';
  }

  saveAlias(version: VersionView): void {
    const alias = this.aliasInputValue.trim() || null;
    this.isSavingAlias = true;
    this.workflowService
      .updateVersionAlias(this.selectedWorkflowId, version.versionId, { alias } satisfies VersionAliasUpdateRequest)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.versions = this.versions.map((v) =>
            v.versionId === version.versionId ? updated : v,
          );
          this.editingAliasVersionId = null;
          this.aliasInputValue = '';
          this.isSavingAlias = false;
          this.setSuccess('Alias saved');
        },
        error: (err: Error) => {
          this.error = this.messageFromError(err, 'Failed to save alias');
          this.isSavingAlias = false;
        },
      });
  }

  // ── Steps ──────────────────────────────────────────────────────────────────

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

  // ── Notifications ──────────────────────────────────────────────────────────

  dismissError(): void { this.error = null; }

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
    if (!this.notificationTimer) return;
    clearTimeout(this.notificationTimer);
    this.notificationTimer = null;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  statusLabel(status: string): string {
    return status
      .toLowerCase()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  statusToken(status: string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  private resolveWorkflowId(): string {
    if (this.routeWorkflowId && this.workflows.some((w) => w.id === this.routeWorkflowId)) {
      return this.routeWorkflowId;
    }
    if (this.selectedWorkflowId && this.workflows.some((w) => w.id === this.selectedWorkflowId)) {
      return this.selectedWorkflowId;
    }
    return this.workflows[0]?.id ?? '';
  }

  private updateUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { workflowId: this.selectedWorkflowId || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  messageFromError(error: Error, fallback: string): string {
    return error.message || fallback;
  }
}
