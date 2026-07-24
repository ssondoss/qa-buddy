import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { PaginatedResponse } from '../../../../shared/api-response.model';
import type {
  RecordingStartResponse,
  VersionAliasUpdateRequest,
  VersionView,
  WorkflowDeletePreview,
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

  getDeletePreview(workflowId: string): Observable<WorkflowDeletePreview> {
    return this.http.get<WorkflowDeletePreview>(`${this.base}/${workflowId}/delete-preview`);
  }

  delete(workflowId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${workflowId}`);
  }

  duplicateVersion(workflowId: string, versionId: string): Observable<VersionView> {
    return this.http.post<VersionView>(`${this.base}/${workflowId}/versions/${versionId}/duplicate`, {});
  }

  deleteVersion(workflowId: string, versionId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${workflowId}/versions/${versionId}`);
  }

  updateVersionAlias(workflowId: string, versionId: string, payload: VersionAliasUpdateRequest): Observable<VersionView> {
    return this.http.patch<VersionView>(`${this.base}/${workflowId}/versions/${versionId}/alias`, payload);
  }

  startRecording(
    workflowId: string,
    payload: WorkflowRecordingStartRequest,
  ): Observable<RecordingStartResponse> {
    return this.http.post<RecordingStartResponse>(`${this.recordingBase}/start/${workflowId}`, payload);
  }

  recordingStatusUrl(versionId: string): string {
    return `${this.recordingBase}/status/${versionId}`;
  }
}
