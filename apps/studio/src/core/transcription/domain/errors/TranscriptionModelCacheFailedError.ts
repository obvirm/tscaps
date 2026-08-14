import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when the on-device transcription model was downloaded but
 * the browser would not keep a copy of it, so the next session has to
 * download it again.
 *
 * Names an operation that runs alongside transcription rather than
 * inside it: the run that triggered this one is unaffected. The
 * refusal is preserved in `cause`, which is what tells a full origin
 * apart from a context that has no storage to offer at all.
 */
export class TranscriptionModelCacheFailedError extends AppError {
  readonly name = 'TranscriptionModelCacheFailedError';

  constructor(options: { cause: unknown }) {
    super('Transcription model was not kept in browser storage', options);
  }
}
