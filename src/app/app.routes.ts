import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password.component';
import { ResetPasswordComponent } from './features/auth/reset-password.component';
import { DashboardShellComponent } from './features/dashboard/dashboard-shell.component';
import { DiscoveredApisComponent } from './features/dashboard/discovered-apis/discovered-apis.component';
import { EnvironmentsComponent } from './features/dashboard/environments/environments.component';
import { ExecutionsComponent } from './features/dashboard/executions.component';
import { ReportsComponent } from './features/dashboard/reports.component';
import { ScheduledComponent } from './features/dashboard/scheduled.component';
import { VersionsComponent } from './features/dashboard/versions/versions.component';
import { WorkflowsComponent } from './features/dashboard/workflows/workflows.component';
import { RegisterComponent } from './features/auth/register.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  {
    path: 'dashboard',
    component: DashboardShellComponent,
    children: [
      { path: 'workflows', component: WorkflowsComponent },
      { path: 'versions', component: VersionsComponent },
      { path: 'environments', component: EnvironmentsComponent },
      { path: 'executions', component: ExecutionsComponent },
      { path: 'scheduled', component: ScheduledComponent },
      { path: 'reports', component: ReportsComponent },
      { path: 'discovered-apis', component: DiscoveredApisComponent },
      { path: '', redirectTo: 'workflows', pathMatch: 'full' },
    ],
  },
  { path: 'record', redirectTo: 'dashboard/workflows', pathMatch: 'full' },
  { path: '', redirectTo: 'dashboard/workflows', pathMatch: 'full' },
];
