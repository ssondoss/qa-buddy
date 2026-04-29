import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type {
  EnvironmentDeleteResponse,
  EnvironmentItemResponse,
  EnvironmentListResponse,
  EnvironmentRequest,
} from '../models/environment.model';

@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  private readonly base = `${environment.apiHost}/api/environments`;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<EnvironmentListResponse> {
    return this.http.get<EnvironmentListResponse>(this.base);
  }

  get(id: string): Observable<EnvironmentItemResponse> {
    return this.http.get<EnvironmentItemResponse>(`${this.base}/${id}`);
  }

  create(payload: EnvironmentRequest): Observable<EnvironmentItemResponse> {
    return this.http.post<EnvironmentItemResponse>(this.base, payload);
  }

  update(id: string, payload: EnvironmentRequest): Observable<EnvironmentItemResponse> {
    return this.http.put<EnvironmentItemResponse>(`${this.base}/${id}`, payload);
  }

  delete(id: string): Observable<EnvironmentDeleteResponse> {
    return this.http.delete<EnvironmentDeleteResponse>(`${this.base}/${id}`);
  }
}
