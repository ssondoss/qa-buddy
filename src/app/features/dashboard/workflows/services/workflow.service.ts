import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { PaginatedResponse } from '../../../../shared/api-response.model';
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

  list(page = 0, size = 10): Observable<PaginatedResponse<WorkflowResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PaginatedResponse<WorkflowResponse>>(this.base, { params });
  }

  get(workflowId: string): Observable<WorkflowResponse> {
    return this.http.get<WorkflowResponse>(`${this.base}/${workflowId}`);
  }

  versions(workflowId: string, page = 0, size = 5): Observable<PaginatedResponse<VersionView>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PaginatedResponse<VersionView>>(`${this.base}/${workflowId}/versions`, { params });
  }

  create(payload: WorkflowUpsertRequest): Observable<WorkflowResponse> {
    return this.http.post<WorkflowResponse>(this.base, payload);
  }

  update(workflowId: string, payload: WorkflowUpsertRequest): Observable<WorkflowResponse> {
    return this.http.put<WorkflowResponse>(`${this.base}/${workflowId}`, payload);
  }

  delete(workflowId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${workflowId}`);
  }

  deleteVersion(workflowId: string, versionId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${workflowId}/versions/${versionId}`);
  }

  startRecording(
    workflowId: string,
    payload: WorkflowRecordingStartRequest,
  ): Observable<WorkflowResponse> {
    return this.http.post<WorkflowResponse>(`${this.recordingBase}/start/${workflowId}`, payload);
  }
}
