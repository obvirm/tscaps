import type { SupportedLanguage } from '@shared/transcription-languages';

/**
 * Persisted record of how the user has picked transcription languages
 * across sessions. Two independent signals: the pick count per
 * language (the "most used" one drives the favorite hint on the
 * picker) and the most recently picked language (drives the
 * "last used" hint). Both are keyed by the language's
 * catalog-independent canonical identity (ISO 639-1), so a pick made
 * under one catalog is visible when the picker later runs under
 * another. Languages without a canonical identity are silently
 * ignored on `recordPick` and never appear in either signal.
 *
 * `counts()` returns a fresh, defensively-copied map keyed by the
 * canonical code; `lastPickedCanonicalCode()` returns the canonical
 * code of the most recent pick, or `null` if none exists yet;
 * `recordPick` increments the entry for the language, creates it if
 * missing, and updates the last-picked pointer.
 */
export interface LanguageUsageRepository {
  counts(): ReadonlyMap<string, number>;
  lastPickedCanonicalCode(): string | null;
  recordPick(language: SupportedLanguage): void;
}
