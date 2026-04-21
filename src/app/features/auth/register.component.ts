import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnDestroy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from './auth.service';
import { ApiErrorResponse } from './models/auth.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private resendCooldownTimerId: number | null = null;

  isSubmitting = false;
  isResendingVerification = false;
  resendCooldownSeconds = 0;
  error: string | null = null;
  success: string | null = null;
  resendMessage: string | null = null;
  canShowResend = false;

  get isResendDisabled(): boolean {
    return (
      this.isResendingVerification ||
      this.resendCooldownSeconds > 0 ||
      this.form.controls.email.invalid
    );
  }

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error = null;
    this.success = null;
    this.resendMessage = null;
    this.isSubmitting = true;

    this.authService
      .register(this.form.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.success = response.message;
          this.canShowResend = true;
          this.startResendCooldown();
          this.form.controls.password.reset('');
          this.form.controls.password.markAsPristine();
          this.form.controls.password.markAsUntouched();
          this.isSubmitting = false;
        },
        error: (error: HttpErrorResponse) => {
          const payload = error.error as ApiErrorResponse;
          this.error = payload.message;
          this.isSubmitting = false;
        },
      });
  }

  resendVerification(): void {
    const emailControl = this.form.controls.email;

    if (emailControl.invalid) {
      emailControl.markAsTouched();
      return;
    }

    this.error = null;
    this.resendMessage = null;
    this.isResendingVerification = true;
    this.startResendCooldown();

    this.authService
      .resendVerification({ email: emailControl.value })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.resendMessage = response.data.message;
          this.isResendingVerification = false;
        },
        error: (error: HttpErrorResponse) => {
          const payload = error.error as ApiErrorResponse;
          this.error = payload.message;
          this.isResendingVerification = false;
        },
      });
  }

  isFieldInvalid(fieldName: 'email' | 'password'): boolean {
    const control = this.form.controls[fieldName];
    return control.invalid && (control.touched || control.dirty);
  }

  ngOnDestroy(): void {
    if (this.resendCooldownTimerId !== null) {
      window.clearInterval(this.resendCooldownTimerId);
    }
  }

  private startResendCooldown(): void {
    if (this.resendCooldownTimerId !== null) {
      window.clearInterval(this.resendCooldownTimerId);
    }

    this.resendCooldownSeconds = 60;
    this.resendCooldownTimerId = window.setInterval(() => {
      const nextSeconds = this.resendCooldownSeconds - 1;
      this.resendCooldownSeconds = Math.max(nextSeconds, 0);

      if (nextSeconds <= 0 && this.resendCooldownTimerId !== null) {
        window.clearInterval(this.resendCooldownTimerId);
        this.resendCooldownTimerId = null;
      }
    }, 1000);
  }
}
