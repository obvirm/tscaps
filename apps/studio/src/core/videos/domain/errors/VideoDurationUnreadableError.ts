import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when a video finishes loading into the preview surface
 * without exposing a readable length. Playback and scrubbing become
 * best-effort because the timeline has no true right edge.
 *
 * Carries identifying facts about the source so telemetry and
 * support can correlate the report with the offending file.
 */
export class VideoDurationUnreadableError extends AppError {
  readonly name = 'VideoDurationUnreadableError';
  readonly fileName: string | null;
  readonly mimeType: string | null;
  readonly size: number | null;

  constructor(options: {
    fileName: string | null;
    mimeType: string | null;
    size: number | null;
    cause?: unknown;
  }) {
    super(`Video duration unreadable for file "${options.fileName ?? 'unknown'}"`, { cause: options.cause });
    this.fileName = options.fileName;
    this.mimeType = options.mimeType;
    this.size = options.size;
  }
}
