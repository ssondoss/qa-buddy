import { Routes } from '@angular/router';
import { RecordComponent } from './features/record/record.component';

export const routes: Routes = [
  { path: 'record', component: RecordComponent },
  { path: '', redirectTo: 'record', pathMatch: 'full' },
];
