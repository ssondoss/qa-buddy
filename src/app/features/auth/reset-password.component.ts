import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, ReactiveFormsModule, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PortfolioFooterComponent } from '../../shared/components/portfolio-footer/portfolio-footer.component';
import { AuthService } from './auth.service';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const parent = control.parent;
  if (!parent) return null;
  const password = parent.get('newPassword')?.value;
  return control.value === password ? null : { mismatch: true };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PortfolioFooterComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  readonly destroyRef = inject(DestroyRef);
  readonly formBuilder = inject(FormBuilder);
  readonly authService = inject(AuthService);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);

  isSubmitting = false;
  success = false;
  error: string | null = null;
  token: string | null = null;

  readonly form = this.formBuilder.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    confirmPassword: ['', [Validators.required, passwordsMatch]],
  });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');

    this.form.controls.newPassword.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.form.controls.confirmPassword.updateValueAndValidity();
      });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.token) {
      this.error = 'Reset token is missing. Please use the link from your email.';
      return;
    }

    this.error = null;
    this.isSubmitting = true;

    this.authService
      .resetPassword(this.token, this.form.getRawValue().newPassword)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.success = true;
          setTimeout(() => this.router.navigate(['/login'], { queryParams: { passwordReset: 'true' } }), 2500);
        },
        error: (err) => {
          this.isSubmitting = false;
          const msg = err?.error?.message;
          this.error = msg ?? 'This reset link is invalid or has expired. Please request a new one.';
        },
      });
  }

  isFieldInvalid(field: 'newPassword' | 'confirmPassword'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }
}
