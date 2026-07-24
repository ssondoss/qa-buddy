import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { PaginatedResponse } from '../../../../shared/api-response.model';
import type { DiscoveredApiPageView } from '../models/discovered-api-page.model';

@Injectable({ providedIn: 'root' })
export class AllDiscoveredApisService {
  private readonly base = `${environment.apiHost}/api/discovered-apis`;

  constructor(private readonly http: HttpClient) {}

  getAll(filters: {
    workflowId?: string;
    versionId?: string;
    stepId?: string;
    page?: number;
    size?: number;
  }): Observable<PaginatedResponse<DiscoveredApiPageView>> {
    let params = new HttpParams();
    if (filters.workflowId) params = params.set('workflowId', filters.workflowId);
    if (filters.versionId) params = params.set('versionId', filters.versionId);
    if (filters.stepId) params = params.set('stepId', filters.stepId);
    if (filters.page != null) params = params.set('page', filters.page);
    if (filters.size != null) params = params.set('size', filters.size);
    return this.http.get<PaginatedResponse<DiscoveredApiPageView>>(this.base, { params });
  }
}
