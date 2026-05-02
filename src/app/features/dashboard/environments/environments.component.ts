import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import type { EnvironmentRequest, EnvironmentResponse } from './models/environment.model';
import { EnvironmentService } from './services/environment.service';

@Component({
  selector: 'app-environments',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './environments.component.html',
  styleUrl: './environments.component.scss',
})
export class EnvironmentsComponent implements OnInit {
  readonly destroyRef = inject(DestroyRef);
  readonly formBuilder = inject(FormBuilder);
  readonly environmentService = inject(EnvironmentService);

  environments: EnvironmentResponse[] = [];
  selectedEnvironmentId = '';
  editingEnvironmentId: string | null = null;
  isLoading = false;
  isSaving = false;
  deletingEnvironmentId: string | null = null;
  showForm = false;
  error: string | null = null;
  success: string | null = null;

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    webBaseUrl: ['', [Validators.required, this.absoluteHttpUrlValidator]],
    apiBaseUrl: ['', [Validators.required, this.absoluteHttpUrlValidator]],
  });

  ngOnInit(): void {
    this.loadEnvironments();
  }

  get selectedEnvironment(): EnvironmentResponse | null {
    return (
      this.environments.find((environment) => environment.id === this.selectedEnvironmentId) ?? null
    );
  }

  get metrics() {
    return [
      { label: 'Environments', value: this.environments.length.toString() },
      { label: 'Web URLs', value: this.environments.filter((item) => item.webBaseUrl).length.toString() },
      { label: 'API URLs', value: this.environments.filter((item) => item.apiBaseUrl).length.toString() },
      { label: 'Selected', value: this.selectedEnvironment ? '1' : '0' },
    ];
  }

  loadEnvironments(): void {
    this.error = null;
    this.isLoading = true;

    this.environmentService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.environments = response;

          if (!this.selectedEnvironmentId && this.environments.length) {
            this.selectedEnvironmentId = this.environments[0].id;
          }

          if (
            this.selectedEnvironmentId &&
            !this.environments.some((environment) => environment.id === this.selectedEnvironmentId)
          ) {
            this.selectedEnvironmentId = this.environments[0]?.id ?? '';
          }

          this.isLoading = false;
        },
        error: (error: Error) => {
          this.error = this.messageFromError(error, 'Failed to load environments');
          this.isLoading = false;
        },
      });
  }

  selectEnvironment(environmentId: string): void {
    this.selectedEnvironmentId = environmentId;
    this.error = null;

    this.environmentService
      .get(environmentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.upsertEnvironment(response),
        error: (error: Error) => {
          this.error = this.messageFromError(error, 'Failed to fetch environment');
        },
      });
  }

  openCreateForm(): void {
    this.showForm = true;
    this.editingEnvironmentId = null;
    this.error = null;
    this.success = null;
    this.form.reset({ name: '', webBaseUrl: '', apiBaseUrl: '' });
  }

  openEditForm(environment: EnvironmentResponse): void {
    this.showForm = true;
    this.editingEnvironmentId = environment.id;
    this.error = null;
    this.success = null;
    this.form.setValue({
      name: environment.name,
      webBaseUrl: environment.webBaseUrl,
      apiBaseUrl: environment.apiBaseUrl,
    });
  }

  closeForm(): void {
    this.showForm = false;
    this.editingEnvironmentId = null;
    this.form.reset({ name: '', webBaseUrl: '', apiBaseUrl: '' });
  }

  saveEnvironment(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.normalizedPayload();
    const request$ = this.editingEnvironmentId
      ? this.environmentService.update(this.editingEnvironmentId, payload)
      : this.environmentService.create(payload);

    this.error = null;
    this.success = null;
    this.isSaving = true;

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.upsertEnvironment(response);
        this.selectedEnvironmentId = response.id;
        this.success = this.editingEnvironmentId ? 'Environment updated' : 'Environment created';
        this.isSaving = false;
        this.closeForm();
      },
      error: (error: Error) => {
        this.error = this.messageFromError(error, 'Failed to save environment');
        this.isSaving = false;
      },
    });
  }

  deleteEnvironment(environment: EnvironmentResponse): void {
    const confirmed = window.confirm(`Delete environment "${environment.name}"?`);

    if (!confirmed) {
      return;
    }

    this.error = null;
    this.success = null;
    this.deletingEnvironmentId = environment.id;

    this.environmentService
      .delete(environment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.environments = this.environments.filter((item) => item.id !== environment.id);
          this.selectedEnvironmentId =
            this.selectedEnvironmentId === environment.id
              ? (this.environments[0]?.id ?? '')
              : this.selectedEnvironmentId;
          this.success = 'Environment deleted';
          this.deletingEnvironmentId = null;
        },
        error: (error: Error) => {
          this.error = this.messageFromError(error, 'Failed to delete environment');
          this.deletingEnvironmentId = null;
        },
      });
  }

  isFieldInvalid(fieldName: 'name' | 'webBaseUrl' | 'apiBaseUrl'): boolean {
    const control = this.form.controls[fieldName];
    return control.invalid && (control.touched || control.dirty);
  }

  formatDate(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  upsertEnvironment(environment: EnvironmentResponse): void {
    this.environments = this.environments.some((item) => item.id === environment.id)
      ? this.environments.map((item) => (item.id === environment.id ? environment : item))
      : [environment, ...this.environments];
  }

  normalizedPayload(): EnvironmentRequest {
    const value = this.form.getRawValue();

    return {
      name: value.name.trim(),
      webBaseUrl: value.webBaseUrl.trim(),
      apiBaseUrl: value.apiBaseUrl.trim(),
    };
  }

  absoluteHttpUrlValidator(control: AbstractControl<string>): ValidationErrors | null {
    const value = control.value?.trim();

    if (!value) {
      return null;
    }

    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:' ? null : { absoluteHttpUrl: true };
    } catch {
      return { absoluteHttpUrl: true };
    }
  }

  messageFromError(error: Error, fallback: string): string {
    return error.message || fallback;
  }
}

