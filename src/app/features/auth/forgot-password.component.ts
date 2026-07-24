import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PortfolioFooterComponent } from '../../shared/components/portfolio-footer/portfolio-footer.component';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PortfolioFooterComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  readonly destroyRef = inject(DestroyRef);
  readonly formBuilder = inject(FormBuilder);
  readonly authService = inject(AuthService);

  isSubmitting = false;
  submitted = false;
  error: string | null = null;

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error = null;
    this.isSubmitting = true;

    this.authService
      .forgotPassword(this.form.getRawValue().email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.submitted = true;
        },
        error: () => {
          this.isSubmitting = false;
          this.submitted = true;
        },
      });
  }

  isFieldInvalid(field: 'email'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }
}
