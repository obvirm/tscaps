/**
 * Raised when the device the transcriber was asked to run on is not
 * usable — either the model does not ship the artefacts needed for
 * that device, or the browser does not expose the runtime that device
 * relies on. Fired before any model file is fetched.
 *
 * The `.name` string is set explicitly, and exposed as `ERROR_NAME` on
 * the class, so consumers can recognise the failure across a Worker
 * boundary (where structured cloning preserves the string fields but
 * not the class identity) with a single source of truth.
 */
export class WhisperDeviceUnavailableError extends Error {
  static readonly ERROR_NAME = 'WhisperDeviceUnavailableError';
  readonly name = WhisperDeviceUnavailableError.ERROR_NAME;
}
