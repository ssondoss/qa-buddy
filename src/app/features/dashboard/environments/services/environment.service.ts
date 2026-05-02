import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { EnvironmentRequest, EnvironmentResponse } from '../models/environment.model';

@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  private readonly base = `${environment.apiHost}/api/environments`;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<EnvironmentResponse[]> {
    return this.http.get<EnvironmentResponse[]>(this.base);
  }

  get(id: string): Observable<EnvironmentResponse> {
    return this.http.get<EnvironmentResponse>(`${this.base}/${id}`);
  }

  create(payload: EnvironmentRequest): Observable<EnvironmentResponse> {
    return this.http.post<EnvironmentResponse>(this.base, payload);
  }

  update(id: string, payload: EnvironmentRequest): Observable<EnvironmentResponse> {
    return this.http.put<EnvironmentResponse>(`${this.base}/${id}`, payload);
  }

  delete(id: string): Observable<EnvironmentResponse | null> {
    return this.http.delete<EnvironmentResponse | null>(`${this.base}/${id}`);
  }
}
