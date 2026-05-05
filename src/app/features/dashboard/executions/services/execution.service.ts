import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { ExecutionView } from '../models/execution.model';

@Injectable({ providedIn: 'root' })
export class ExecutionService {
  private readonly base = `${environment.apiHost}/api/workflows`;

  constructor(private readonly http: HttpClient) {}

  execute(workflowId: string, versionId: string): Observable<ExecutionView> {
    return this.http.post<ExecutionView>(
      `${this.base}/${workflowId}/versions/${versionId}/execute`,
      {},
    );
  }

  listByWorkflow(workflowId: string): Observable<ExecutionView[]> {
    return this.http.get<ExecutionView[]>(`${this.base}/${workflowId}/executions`);
  }

  getById(workflowId: string, executionId: string): Observable<ExecutionView> {
    return this.http.get<ExecutionView>(`${this.base}/${workflowId}/executions/${executionId}`);
  }
}