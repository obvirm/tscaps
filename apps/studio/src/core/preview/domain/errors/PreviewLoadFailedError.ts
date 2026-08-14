import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when the preview surface cannot open the video it was given —
 * the blob has no video track, its codec stopped being decodable, or
 * the decoder worker failed to start. The underlying error is preserved
 * verbatim in `cause` for telemetry and support inspection.
 */
export class PreviewLoadFailedError extends AppError {
  readonly name = 'PreviewLoadFailedError';

  constructor(options: { cause: unknown }) {
    super('Preview failed to load', options);
  }
}
