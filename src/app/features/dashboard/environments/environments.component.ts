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
  isModalOpen = false;
  editingEnvironment: EnvironmentResponse | null = null;
  viewingEnvironment: EnvironmentResponse | null = null;
  isLoading = false;
  isSaving = false;
  confirmingDeleteId: string | null = null;
  isDeletingEnvironment = false;
  error: string | null = null;

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.maxLength(500)]],
    webBaseUrl: ['', [Validators.required, this.absoluteHttpUrlValidator]],
    apiBaseUrl: ['', [this.absoluteHttpUrlValidator]],
  });

  ngOnInit(): void {
    this.loadEnvironments();
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
          this.isLoading = false;
        },
        error: (error: Error) => {
          this.error = error.message || 'Failed to load environments';
          this.isLoading = false;
        },
      });
  }

  openCreateModal(): void {
    this.editingEnvironment = null;
    this.error = null;
    this.form.reset({ name: '', description: '', webBaseUrl: '', apiBaseUrl: '' });
    this.isModalOpen = true;
  }

  openDuplicateModal(environment: EnvironmentResponse): void {
    this.editingEnvironment = null;
    this.error = null;
    this.form.reset({
      name: `${environment.name} (copy)`,
      description: environment.description ?? '',
      webBaseUrl: environment.webBaseUrl,
      apiBaseUrl: environment.apiBaseUrl ?? '',
    });
    this.isModalOpen = true;
  }

  openEditModal(environment: EnvironmentResponse): void {
    this.editingEnvironment = environment;
    this.error = null;
    this.form.setValue({
      name: environment.name,
      description: environment.description ?? '',
      webBaseUrl: environment.webBaseUrl,
      apiBaseUrl: environment.apiBaseUrl ?? '',
    });
    this.isModalOpen = true;
  }

  closeModal(): void {
    if (this.isSaving) return;
    this.isModalOpen = false;
    this.editingEnvironment = null;
    this.form.reset();
    this.error = null;
  }

  openInfoModal(environment: EnvironmentResponse): void {
    this.viewingEnvironment = environment;
  }

  closeInfoModal(): void {
    this.viewingEnvironment = null;
  }

  editFromInfo(): void {
    const env = this.viewingEnvironment;
    if (!env) return;
    this.closeInfoModal();
    this.openEditModal(env);
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  saveEnvironment(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    const request$ = this.editingEnvironment
      ? this.environmentService.update(this.editingEnvironment.id, payload)
      : this.environmentService.create(payload);

    this.error = null;
    this.isSaving = true;

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.upsertEnvironment(response);
        this.isSaving = false;
        this.closeModal();
      },
      error: (error: Error) => {
        this.error = error.message || 'Failed to save environment';
        this.isSaving = false;
      },
    });
  }

  requestDelete(event: Event, environment: EnvironmentResponse): void {
    event.stopPropagation();
    this.confirmingDeleteId = environment.id;
  }

  cancelDelete(): void {
    this.confirmingDeleteId = null;
  }

  confirmDelete(environment: EnvironmentResponse): void {
    if (this.isDeletingEnvironment) return;
    this.isDeletingEnvironment = true;
    this.error = null;

    this.environmentService
      .delete(environment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.environments = this.environments.filter((item) => item.id !== environment.id);
          this.isDeletingEnvironment = false;
          this.confirmingDeleteId = null;
        },
        error: (error: Error) => {
          this.error = error.message || 'Failed to delete environment';
          this.isDeletingEnvironment = false;
          this.confirmingDeleteId = null;
        },
      });
  }

  isFieldInvalid(fieldName: 'name' | 'description' | 'webBaseUrl' | 'apiBaseUrl'): boolean {
    const control = this.form.controls[fieldName];
    return control.invalid && (control.touched || control.dirty);
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

  private upsertEnvironment(environment: EnvironmentResponse): void {
    this.environments = this.environments.some((item) => item.id === environment.id)
      ? this.environments.map((item) => (item.id === environment.id ? environment : item))
      : [environment, ...this.environments];
  }

  private buildPayload(): EnvironmentRequest {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      description: value.description.trim() || null,
      webBaseUrl: value.webBaseUrl.trim(),
      apiBaseUrl: value.apiBaseUrl.trim() || null,
    };
  }

  absoluteHttpUrlValidator(control: AbstractControl<string>): ValidationErrors | null {
    const value = control.value?.trim();
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:' ? null : { absoluteHttpUrl: true };
    } catch {
      return { absoluteHttpUrl: true };
    }
  }
}
