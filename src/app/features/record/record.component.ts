import { Component, DestroyRef, inject, NgZone } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RecordService } from './record.service';
import type { RecordingPhase } from '@qa-buddy/shared-types';

@Component({
  selector: 'app-record',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './record.component.html',
})
export class RecordComponent {
  url = '';
  phase: RecordingPhase = 'idle';
  generatedScript: string | null = null;
  error: string | null = null;

  private destroyRef = inject(DestroyRef);

  constructor(private recordService: RecordService, private zone: NgZone) {}

  open(): void {
    this.error = null;
    this.generatedScript = null;

    this.recordService.open({ url: this.url })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          console.log('[record] SSE event received:', status);
          this.zone.run(() => {
            this.phase = status.phase;

            if (status.phase === 'idle' && status.hasResult) {
              this.recordService.getResult().subscribe({
                next: (res) => {
                  console.log('[record] result received, length:', res.content.length);
                  this.generatedScript = res.content;
                },
                error: (err) => (this.error = err.error?.error ?? 'Failed to fetch result'),
              });
            }
          });
        },
        error: (err) => this.zone.run(() => (this.error = err?.error ?? 'Failed to open browser')),
      });
  }
}
