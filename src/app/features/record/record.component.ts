import { Component, DestroyRef, inject } from '@angular/core';
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
  url = '';
  phase: RecordingPhase = 'idle';
  generatedScript: string | null = null;
  error: string | null = null;

  get workflowSteps() {
    return this.workflowParser.parse(this.generatedScript);
  }

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly recordService: RecordService,
    private readonly workflowParser: RecordWorkflowParserService,
  ) {}

  open(): void {
    this.error = null;
    this.generatedScript = null;

    this.recordService
      .open({ url: this.url })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.phase = status.phase;

          if (status.phase === 'idle' && status.hasResult) {
            this.recordService
              .getResult()
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (res) => {
                  this.generatedScript = res.content;
                },
                error: (err) => this.error = err.error?.error ?? 'Failed to fetch result',
              });
          }
        },
        error: (err) => this.error = err?.error ?? 'Failed to open browser',
      });
  }
}
