import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import type {
  StepReorderRequest,
  StepRequest,
  StepView,
} from '../models/step.model';

@Injectable({ providedIn: 'root' })
export class StepService {
  private readonly base = `${environment.apiHost}/api/steps`;

  constructor(private readonly http: HttpClient) {}

  list(versionId: string): Observable<StepView[]> {
    return this.http.get<StepView[]>(`${this.base}/${versionId}`);
  }

  create(versionId: string, payload: StepRequest): Observable<StepView> {
    return this.http.post<StepView>(`${this.base}/${versionId}`, payload);
  }

  update(versionId: string, stepId: string, payload: StepRequest): Observable<StepView> {
    return this.http.put<StepView>(`${this.base}/${versionId}/${stepId}`, payload);
  }

  delete(versionId: string, stepId: string): Observable<null> {
    return this.http.delete<null>(`${this.base}/${versionId}/${stepId}`);
  }

  reorder(versionId: string, payload: StepReorderRequest): Observable<StepView[]> {
    return this.http.patch<StepView[]>(`${this.base}/${versionId}/reorder`, payload);
  }
}
