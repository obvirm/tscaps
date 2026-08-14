import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when the audio track of a source media file could not be
 * demuxed or decoded — the operation is "read the audio out of this
 * container", not any particular codec or transport. Every path that
 * needs the audio bytes ahead of transcription fails with this name,
 * so a single dispatch tells the reader which operation broke and
 * its `cause` tells them why. The original library / browser error
 * is preserved verbatim in `cause` for telemetry and support
 * inspection.
 */
export class AudioExtractionFailedError extends AppError {
  readonly name = 'AudioExtractionFailedError';

  constructor(options: { cause: unknown }) {
    super('Audio extraction failed', options);
  }
}
