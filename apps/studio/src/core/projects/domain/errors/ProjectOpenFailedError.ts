import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when a project that exists could not be brought into the
 * editor — its record or its video would not come back from storage,
 * the bytes that did come back turned out to be undecodable, or the
 * hydration failed somewhere in between. The underlying error is
 * preserved verbatim in `cause`.
 *
 * A project whose video was evicted is not this: those bytes are
 * gone by design and the reader is asked for the file again.
 */
export class ProjectOpenFailedError extends AppError {
  readonly name = 'ProjectOpenFailedError';

  constructor(options: { cause: unknown }) {
    super('Project failed to open', options);
  }
}
