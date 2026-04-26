import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { CreateWorkflowResponse, WorkflowRequest } from '../models/workflow.model';

@Injectable({ providedIn: 'root' })
export class WorkflowService {
  private readonly base = `${environment.apiHost}/api/workflows`;

  constructor(private readonly http: HttpClient) {}

  create(payload: WorkflowRequest): Observable<CreateWorkflowResponse> {
    return this.http.post<CreateWorkflowResponse>(this.base, payload);
  }
}
