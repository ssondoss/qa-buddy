/** UI-only state for an active recording session — not part of the API contract */
export interface RecordingSession {
  isRecording: boolean;
  outputFile: string | null;
  script: string | null;
  error: string | null;
}
