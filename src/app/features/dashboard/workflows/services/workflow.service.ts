import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type {
  VersionView,
  WorkflowRecordingStartRequest,
  WorkflowResponse,
  WorkflowUpsertRequest,
} from '../models/workflow.model';

@Injectable({ providedIn: 'root' })
export class WorkflowService {
  private readonly base = `${environment.apiHost}/api/workflows`;
  private readonly recordingBase = `${environment.apiHost}/api/version/recording`;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<WorkflowResponse[]> {
    return this.http.get<WorkflowResponse[]>(this.base);
  }

  get(workflowId: string): Observable<WorkflowResponse> {
    return this.http.get<WorkflowResponse>(`${this.base}/${workflowId}`);
  }

  versions(workflowId: string): Observable<VersionView[]> {
    return this.http.get<VersionView[]>(`${this.base}/${workflowId}/versions`);
  }

  create(payload: WorkflowUpsertRequest): Observable<WorkflowResponse> {
    return this.http.post<WorkflowResponse>(this.base, payload);
  }

  update(workflowId: string, payload: WorkflowUpsertRequest): Observable<WorkflowResponse> {
    return this.http.put<WorkflowResponse>(`${this.base}/${workflowId}`, payload);
  }

  startRecording(
    workflowId: string,
    payload: WorkflowRecordingStartRequest,
  ): Observable<WorkflowResponse> {
    return this.http.post<WorkflowResponse>(`${this.recordingBase}/start/${workflowId}`, payload);
  }
}
