import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type {
  CreateWorkflowResponse,
  StartRecordingResponse,
  WorkflowListResponse,
  WorkflowRecordingStartRequest,
  WorkflowRequest,
} from '../models/workflow.model';

@Injectable({ providedIn: 'root' })
export class WorkflowService {
  private readonly base = `${environment.apiHost}/api/workflows`;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<WorkflowListResponse> {
    return this.http.get<WorkflowListResponse>(this.base);
  }

  create(payload: WorkflowRequest): Observable<CreateWorkflowResponse> {
    return this.http.post<CreateWorkflowResponse>(this.base, payload);
  }

  startRecording(
    workflowId: string,
    payload: WorkflowRecordingStartRequest,
  ): Observable<StartRecordingResponse> {
    return this.http.post<StartRecordingResponse>(`${this.base}/${workflowId}/versions/start`, payload);
  }
}
