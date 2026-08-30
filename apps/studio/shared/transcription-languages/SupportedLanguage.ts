/**
 * A speech-recognition language the transcriber can produce output in.
 * `code` is the identifier the transcriber expects at request time;
 * different transcribers may use different ISO 639 conventions.
 * `nameEn` is the English display name; `nativeName` is the language's
 * endonym, the way the language names itself. When both strings are
 * equal the language is either English or ships no distinct endonym
 * and the caller should render `nameEn` alone.
 *
 * `iso639_1` is the catalog-independent identity of the language,
 * used to match picks across catalogs and to match against browser
 * signals like `navigator.languages`. Optional because some catalogs
 * already store an ISO 639-1 code in `code` (in which case the
 * resolver falls back to `code`), and because a handful of languages
 * have no assigned 639-1 identifier and are therefore excluded from
 * cross-catalog matching.
 */
export interface SupportedLanguage {
  readonly code: string;
  readonly nameEn: string;
  readonly nativeName: string;
  readonly iso639_1?: string;
}
