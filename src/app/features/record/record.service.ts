import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  RecordOpenBody,
  RecordingStatus,
  RecordResult,
} from '@qa-buddy/shared-types';

@Injectable({ providedIn: 'root' })
export class RecordService {
  private readonly base = 'http://localhost:3000/record';

  constructor(private http: HttpClient) {}

  // Opens Playwright and returns an Observable that emits SSE events
  // until the QA closes the browser
  open({ url }: RecordOpenBody): Observable<RecordingStatus> {
    return new Observable((observer) => {
      const controller = new AbortController();

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
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // SSE lines look like: "data: {...}\n\n"
            const text = decoder.decode(value);
            for (const line of text.split('\n')) {
              if (line.startsWith('data: ')) {
                observer.next(JSON.parse(line.slice(6)) as RecordingStatus);
              }
            }
          }

          observer.complete();
        })
        .catch((err) => {
          if (err.name !== 'AbortError') observer.error(err);
        });

      // cancel the stream if the Observable is unsubscribed
      return () => controller.abort();
    });
  }

  getResult(): Observable<RecordResult> {
    return this.http.get<RecordResult>(`${this.base}/result`);
  }
}
