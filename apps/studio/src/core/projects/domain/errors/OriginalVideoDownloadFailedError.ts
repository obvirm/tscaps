import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when the original video of an open project could not be
 * brought into the session — the transport refused, the request came
 * back without bytes, or the project has no source to fetch from.
 * The underlying error is preserved verbatim in `cause`.
 *
 * The editor stays usable without it; only the export needs the
 * original.
 */
export class OriginalVideoDownloadFailedError extends AppError {
  readonly name = 'OriginalVideoDownloadFailedError';

  constructor(options: { cause: unknown }) {
    super('Original video download failed', options);
  }
}
