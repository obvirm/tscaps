/**
 * A speech-recognition language the transcriber can produce output in.
 * `code` is the identifier the transcriber expects at request time;
 * different transcribers may use different ISO 639 conventions.
 * `nameEn` is the English display name; `nativeName` is the language's
 * endonym — the way the language names itself. When both strings are
 * equal the language is either English or ships no distinct endonym
 * and the caller should render `nameEn` alone.
 */
export interface SupportedLanguage {
  readonly code: string;
  readonly nameEn: string;
  readonly nativeName: string;
}
