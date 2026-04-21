import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { RecordComponent } from './features/record/record.component';
import { RegisterComponent } from './features/auth/register.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'record', component: RecordComponent },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
