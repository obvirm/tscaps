/**
 * Raised when preparing the Whisper pipeline fails — the model files
 * could not be fetched, the runtime could not instantiate them, or an
 * upstream library rejected the load for any other reason.
 *
 * The `.name` string is set explicitly, and exposed as `ERROR_NAME` on
 * the class, so consumers can recognise the failure across a Worker
 * boundary (where structured cloning preserves the string fields but
 * not the class identity) with a single source of truth.
 */
export class WhisperModelLoadFailedError extends Error {
  static readonly ERROR_NAME = 'WhisperModelLoadFailedError';
  readonly name = WhisperModelLoadFailedError.ERROR_NAME;
}
