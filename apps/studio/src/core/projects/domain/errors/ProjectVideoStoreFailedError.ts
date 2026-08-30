import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when the browser refused to keep a copy of a project's
 * source video on this device. The bytes stay attached to the session
 * either way — what is lost is the next open.
 *
 * `hasRemoteCopy` says what that next open will have to do: fetch the
 * video from a server on its own, or ask the reader for the file
 * again. It is not the same question as whether this session syncs at
 * all — a project being recovered has already been found missing
 * from every server that could have held it, and asks for the file
 * like any other.
 */
export class ProjectVideoStoreFailedError extends AppError {
  readonly name = 'ProjectVideoStoreFailedError';

  readonly hasRemoteCopy: boolean;

  constructor(options: { cause: unknown; hasRemoteCopy: boolean }) {
    super('Project video could not be stored', options);
    this.hasRemoteCopy = options.hasRemoteCopy;
  }
}
