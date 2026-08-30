import type { SupportedLanguage } from '@shared/transcription-languages';

/**
 * Resolves the catalog-independent identity of a `SupportedLanguage`.
 * The canonical identity is the language's ISO 639-1 two-letter code,
 * which is used to compare a user's picks across catalogs and to
 * match browser-side language and timezone signals against a catalog
 * entry.
 *
 * The lookup order is: the explicit `iso639_1` field on the entry
 * first, and if absent the entry's `code` when it already matches the
 * 639-1 shape. Returns `undefined` for languages with no assigned
 * 639-1 identifier — those languages are simply excluded from
 * cross-catalog matching, never confused with each other.
 */
export class LanguageCanonicalCodeResolver {

  of(language: SupportedLanguage): string | undefined {
    if (language.iso639_1 !== undefined) return language.iso639_1;
    if (/^[a-z]{2}$/.test(language.code)) return language.code;
    return undefined;
  }
}
