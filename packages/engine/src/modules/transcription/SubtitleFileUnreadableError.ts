/**
 * Raised when a caption file yielded no cues at all and at least one
 * of its blocks was unreadable.
 *
 * Skipping the odd broken block leaves a usable file behind; skipping
 * every block does not, and handing back an empty transcript would
 * read as "this file said nothing" rather than "this file could not
 * be understood".
 *
 * A file that is genuinely empty is not this: it yields an empty
 * document, because there is nothing to misread.
 *
 * The `.name` string is set explicitly, and exposed as `ERROR_NAME` on
 * the class, so consumers can recognise the failure across a Worker
 * boundary (where structured cloning preserves the string fields but
 * not the class identity) with a single source of truth.
 */
export class SubtitleFileUnreadableError extends Error {
  static readonly ERROR_NAME = 'SubtitleFileUnreadableError';
  readonly name = SubtitleFileUnreadableError.ERROR_NAME;
}
