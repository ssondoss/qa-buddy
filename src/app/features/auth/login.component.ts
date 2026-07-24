import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PortfolioFooterComponent } from '../../shared/components/portfolio-footer/portfolio-footer.component';
import { AuthService } from './auth.service';
import { AUTH_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from './models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PortfolioFooterComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  readonly destroyRef = inject(DestroyRef);
  readonly formBuilder = inject(FormBuilder);
  readonly authService = inject(AuthService);
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);

  isSubmitting = false;
  error: string | null = null;
  passwordResetSuccess = false;

  ngOnInit(): void {
    this.passwordResetSuccess = this.route.snapshot.queryParamMap.get('passwordReset') === 'true';
  }

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
          localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.accessToken);
          localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, response.refreshToken);
          this.isSubmitting = false;
          void this.router.navigateByUrl('/record');
        },
        error: (error: Error) => {
          this.error = error.message;
          this.isSubmitting = false;
        },
      });
  }

  isFieldInvalid(fieldName: 'email' | 'password'): boolean {
    const control = this.form.controls[fieldName];
    return control.invalid && (control.touched || control.dirty);
  }
}

