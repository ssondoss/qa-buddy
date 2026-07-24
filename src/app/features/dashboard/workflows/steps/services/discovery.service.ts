import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import type { StepApiDiscoveryResult, StepDiscoveredApiView } from '../models/discovered-api.model';

@Injectable({ providedIn: 'root' })
export class DiscoveryService {
  private readonly base = `${environment.apiHost}/api/workflows`;

  constructor(private readonly http: HttpClient) {}

  discoverApis(workflowId: string, versionId: string, stepIds?: string[]): Observable<StepApiDiscoveryResult[]> {
    const body = stepIds?.length ? { stepIds } : {};
    return this.http.post<StepApiDiscoveryResult[]>(
      `${this.base}/${workflowId}/versions/${versionId}/discover-apis`,
      body,
    );
  }

  getDiscoveredApis(workflowId: string, versionId: string): Observable<StepApiDiscoveryResult[]> {
    return this.http.get<StepApiDiscoveryResult[]>(
      `${this.base}/${workflowId}/versions/${versionId}/discovered-apis`,
    );
  }

  getDiscoveredApisForStep(
    workflowId: string,
    versionId: string,
    stepId: string,
  ): Observable<StepDiscoveredApiView[]> {
    return this.http.get<StepDiscoveredApiView[]>(
      `${this.base}/${workflowId}/versions/${versionId}/steps/${stepId}/discovered-apis`,
    );
  }
}