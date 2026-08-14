/**
 * Raised when the runtime exposes no place to keep model files, so
 * every run has to download them again.
 *
 * The Cache Storage API is restricted to secure contexts and withheld
 * altogether by some privacy modes, so a page served over plain HTTP
 * from anything other than localhost has nowhere to put them.
 *
 * The `.name` string is set explicitly, and exposed as `ERROR_NAME` on
 * the class, so consumers can recognise the failure across a Worker
 * boundary (where structured cloning preserves the string fields but
 * not the class identity) with a single source of truth.
 */
export class ModelFileCacheUnavailableError extends Error {
  static readonly ERROR_NAME = 'ModelFileCacheUnavailableError';
  readonly name = ModelFileCacheUnavailableError.ERROR_NAME;
}
