import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { WorkflowEditorComponent } from './components/workflow-editor/workflow-editor.component';
import type { RecordingPhase } from './models/record-contract.model';
import { RecordWorkflowParserService } from './services/record-workflow-parser.service';
import { RecordService } from './services/record.service';

@Component({
  selector: 'app-record',
  standalone: true,
  imports: [FormsModule, WorkflowEditorComponent],
  templateUrl: './record.component.html',
  styleUrl: './record.component.scss',
})
export class RecordComponent {
  readonly url = signal('');
  readonly phase = signal<RecordingPhase>('idle');
  readonly generatedScript = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly workflowSteps = computed(() => this.workflowParser.parse(this.generatedScript()));

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly recordService: RecordService,
    private readonly workflowParser: RecordWorkflowParserService,
  ) {}

  open(): void {
    this.error.set(null);
    this.generatedScript.set(null);

    this.recordService
      .open({ url: this.url() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.phase.set(status.phase);

          if (status.phase === 'idle' && status.hasResult) {
            this.recordService
              .getResult()
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (res) => {
                  this.generatedScript.set(res.content);
                },
                error: (err) => this.error.set(err.error?.error ?? 'Failed to fetch result'),
              });
          }
        },
        error: (err) => this.error.set(err?.error ?? 'Failed to open browser'),
      });
  }
}
