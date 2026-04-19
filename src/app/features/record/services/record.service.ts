import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  RecordOpenBody,
  RecordResult,
  RecordingStatus,
} from '../models/record-contract.model';

@Injectable({ providedIn: 'root' })
export class RecordService {
  private readonly base = 'http://localhost:3000/record';

  constructor(private http: HttpClient) {}

  open({ url }: RecordOpenBody): Observable<RecordingStatus> {
    return new Observable((observer) => {
      const controller = new AbortController();
      const decoder = new TextDecoder();
      let buffer = '';

      fetch(`${this.base}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok || !response.body) {
            const err = await response.json();
            observer.error(err);
            return;
          }

          const reader = response.body.getReader();

          while (true) {
            const { done, value } = await reader.read();
            buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done }).replace(/\r\n/g, '\n');

            const events = buffer.split('\n\n');
            buffer = events.pop() ?? '';

            for (const event of events) {
              for (const line of event.split('\n')) {
                if (line.startsWith('data: ')) {
                  observer.next(JSON.parse(line.slice(6)) as RecordingStatus);
                }
              }
            }

            if (done) {
              break;
            }
          }

          observer.complete();
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            observer.error(err);
          }
        });

      return () => controller.abort();
    });
  }

  getResult(): Observable<RecordResult> {
    return this.http.get<RecordResult>(`${this.base}/result`);
  }
}
