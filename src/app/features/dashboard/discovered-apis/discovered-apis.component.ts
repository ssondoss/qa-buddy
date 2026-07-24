import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import type { WorkflowResponse, VersionView } from '../workflows/models/workflow.model';
import { WorkflowService } from '../workflows/services/workflow.service';
import { StepService } from '../workflows/steps/services/step.service';
import type { StepView } from '../workflows/steps/models/step.model';
import { AllDiscoveredApisService } from './services/all-discovered-apis.service';
import type { DiscoveredApiPageView } from './models/discovered-api-page.model';

@Component({
  selector: 'app-discovered-apis',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './discovered-apis.component.html',
  styleUrl: './discovered-apis.component.scss',
})
export class DiscoveredApisComponent implements OnInit {
  readonly destroyRef = inject(DestroyRef);

  workflows: WorkflowResponse[] = [];
  versions: VersionView[] = [];
  steps: StepView[] = [];
  apis: DiscoveredApiPageView[] = [];

  selectedWorkflowId = '';
  selectedVersionId = '';
  selectedStepId = '';

  isLoading = false;
  error: string | null = null;

  page = 0;
  totalPages = 0;
  totalElements = 0;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly workflowService: WorkflowService,
    private readonly stepService: StepService,
    private readonly allDiscoveredApisService: AllDiscoveredApisService,
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.selectedWorkflowId = params.get('workflowId') ?? '';
    this.selectedVersionId = params.get('versionId') ?? '';
    this.selectedStepId = params.get('stepId') ?? '';

    this.loadWorkflows();
  }

  private loadWorkflows(): void {
    this.workflowService
      .list(0, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.workflows = response.items;
          if (this.selectedWorkflowId) {
            this.loadVersionsForWorkflow(this.selectedWorkflowId);
          } else {
            this.loadApis();
          }
        },
        error: () => {
          this.loadApis();
        },
      });
  }

  private loadVersionsForWorkflow(workflowId: string): void {
    this.workflowService
      .versions(workflowId, 0, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.versions = response.items;
          if (this.selectedVersionId) {
            this.loadStepsForVersion(this.selectedVersionId);
          } else {
            this.loadApis();
          }
        },
        error: () => {
          this.versions = [];
          this.loadApis();
        },
      });
  }

  private loadStepsForVersion(versionId: string): void {
    this.stepService
      .list(versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (steps) => {
          this.steps = steps;
          this.loadApis();
        },
        error: () => {
          this.steps = [];
          this.loadApis();
        },
      });
  }

  loadApis(): void {
    this.isLoading = true;
    this.error = null;

    this.allDiscoveredApisService
      .getAll({
        workflowId: this.selectedWorkflowId || undefined,
        versionId: this.selectedVersionId || undefined,
        stepId: this.selectedStepId || undefined,
        page: this.page,
        size: 20,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.apis = response.items;
          this.totalPages = response.totalPages;
          this.totalElements = response.totalElements;
          this.isLoading = false;
        },
        error: (err: Error) => {
          this.error = err.message || 'Failed to load discovered APIs';
          this.isLoading = false;
        },
      });
  }

  applyFilters(): void {
    this.page = 0;
    this.loadApis();
  }

  clearFilters(): void {
    this.selectedWorkflowId = '';
    this.selectedVersionId = '';
    this.selectedStepId = '';
    this.versions = [];
    this.steps = [];
    this.page = 0;
    this.loadApis();
  }

  onWorkflowChange(workflowId: string): void {
    this.selectedVersionId = '';
    this.selectedStepId = '';
    this.versions = [];
    this.steps = [];
    this.page = 0;

    if (workflowId) {
      this.workflowService
        .versions(workflowId, 0, 100)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            this.versions = response.items;
          },
          error: () => {
            this.versions = [];
          },
        });
    }

    this.loadApis();
  }

  onVersionChange(versionId: string): void {
    this.selectedStepId = '';
    this.steps = [];
    this.page = 0;

    if (versionId) {
      this.stepService
        .list(versionId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (steps) => {
            this.steps = steps;
          },
          error: () => {
            this.steps = [];
          },
        });
    }

    this.loadApis();
  }

  onStepChange(): void {
    this.page = 0;
    this.loadApis();
  }

  goToPage(p: number): void {
    if (p < 0 || p >= this.totalPages) return;
    this.page = p;
    this.loadApis();
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

  statusToken(status: string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  statusLabel(status: string): string {
    return status
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
