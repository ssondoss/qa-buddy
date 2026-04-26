import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PortfolioFooterComponent } from '../../shared/components/portfolio-footer/portfolio-footer.component';
import { AuthService } from './auth.service';
import { ApiErrorResponse, AUTH_TOKEN_STORAGE_KEY } from './models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PortfolioFooterComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isSubmitting = false;
  error: string | null = null;

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(72)]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error = null;
    this.isSubmitting = true;

    this.authService
      .login(this.form.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.data.token);
          this.isSubmitting = false;
          void this.router.navigateByUrl('/record');
        },
        error: (error: HttpErrorResponse) => {
          const payload = error.error as ApiErrorResponse;
          this.error = payload.message;
          this.isSubmitting = false;
        },
      });
  }

  isFieldInvalid(fieldName: 'email' | 'password'): boolean {
    const control = this.form.controls[fieldName];
    return control.invalid && (control.touched || control.dirty);
  }
}
