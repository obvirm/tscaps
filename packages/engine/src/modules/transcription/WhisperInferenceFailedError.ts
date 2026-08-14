/**
 * Raised when the Whisper pipeline was loaded successfully but the
 * inference call itself rejected — the model ran out of memory, the
 * WebGPU device was lost mid-decode, the input audio was too short,
 * or any other runtime error surfaced while transcribing.
 *
 * The `.name` string is set explicitly, and exposed as `ERROR_NAME` on
 * the class, so consumers can recognise the failure across a Worker
 * boundary (where structured cloning preserves the string fields but
 * not the class identity) with a single source of truth.
 */
export class WhisperInferenceFailedError extends Error {
  static readonly ERROR_NAME = 'WhisperInferenceFailedError';
  readonly name = WhisperInferenceFailedError.ERROR_NAME;
}
