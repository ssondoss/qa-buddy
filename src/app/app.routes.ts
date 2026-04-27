import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { DashboardShellComponent } from './features/dashboard/dashboard-shell.component';
import { ExecutionsComponent } from './features/dashboard/executions.component';
import { ReportsComponent } from './features/dashboard/reports.component';
import { ScheduledComponent } from './features/dashboard/scheduled.component';
import { WorkflowsComponent } from './features/dashboard/workflows/workflows.component';
import { RegisterComponent } from './features/auth/register.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: 'dashboard',
    component: DashboardShellComponent,
    children: [
      { path: 'workflows', component: WorkflowsComponent },
      { path: 'executions', component: ExecutionsComponent },
      { path: 'scheduled', component: ScheduledComponent },
      { path: 'reports', component: ReportsComponent },
      { path: '', redirectTo: 'workflows', pathMatch: 'full' },
    ],
  },
  { path: 'record', redirectTo: 'dashboard/workflows', pathMatch: 'full' },
  { path: '', redirectTo: 'dashboard/workflows', pathMatch: 'full' },
];
