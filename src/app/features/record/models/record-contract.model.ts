export interface RecordOpenBody {
  url: string;
  workflowId?: string;
}

export type RecordingPhase = 'idle' | 'recording';

export interface RecordingStatus {
  phase: RecordingPhase;
  hasResult: boolean;
}

export interface RecordResult {
  content: string;
  file: string;
}
