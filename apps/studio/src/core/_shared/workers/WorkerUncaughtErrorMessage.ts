/** Discriminator for the envelope a worker sends on an uncaught failure. */
export const WORKER_UNCAUGHT_ERROR_MESSAGE_TYPE = '__worker_uncaught_error';

/**
 * An uncaught worker failure, flattened into a structured-cloneable
 * shape. `Error` instances survive `postMessage` unevenly across
 * browsers, so the three fields travel as plain strings and the
 * receiver rebuilds an `Error` from them.
 *
 * The type tag is deliberately distinct from every per-worker protocol
 * so an owner that does not handle it simply ignores it.
 */
export interface WorkerUncaughtErrorMessage {
  readonly type: typeof WORKER_UNCAUGHT_ERROR_MESSAGE_TYPE;
  readonly errorName: string;
  readonly errorMessage: string;
  readonly errorStack: string | null;
}
