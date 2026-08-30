import type { SupportedLanguage } from '@shared/transcription-languages';
import type { LanguageUsageRepository } from '@core/preprocessing/domain/LanguageUsageRepository';
import type { BrowserLocaleInspector } from '@core/preprocessing/services/BrowserLocaleInspector';
import type { LanguageCanonicalCodeResolver } from '@core/preprocessing/services/LanguageCanonicalCodeResolver';

/**
 * Result of ranking a language list. `languages` is the full input
 * list, reordered as: most-used, then last-used (if different),
 * then browser / timezone matches, then a curated popular set, then
 * everything else in its original order. `mostUsedCode` and
 * `lastUsedCode` are the surface-specific `code` of those two rows
 * (so the picker can compare against option values directly) or
 * `null` when either could not be resolved against the input list;
 * they may coincide.
 */
export interface RankedLanguages {
  readonly languages: readonly SupportedLanguage[];
  readonly mostUsedCode: string | null;
  readonly lastUsedCode: string | null;
}

/**
 * Sorts a transcription-language list to put the picks the user is
 * most likely to want first. Ranking sources, from strongest to
 * weakest: the most-picked language across sessions, then the last
 * picked one (when it differs), then browser / timezone hints, then a
 * small curated set of globally popular languages so first-time users
 * see a useful top slice, then the input order for the tail. Matching
 * happens on the canonical ISO 639-1 identity of each entry, so a
 * favorite recorded under one catalog surfaces in another. The
 * returned list carries the same entries as the input — nothing is
 * dropped or duplicated, only reordered.
 */
export class LanguageRanker {

  private static readonly POPULAR_CANONICAL_CODES: readonly string[] = [
    'en', 'es', 'pt', 'fr', 'de', 'it', 'ja', 'ko', 'zh', 'ru',
  ];

  constructor(
    private readonly usage: LanguageUsageRepository,
    private readonly locale: BrowserLocaleInspector,
    private readonly canonicalCodeResolver: LanguageCanonicalCodeResolver,
  ) {}

  rank(languages: readonly SupportedLanguage[]): RankedLanguages {
    const byCanonical = this.indexByCanonical(languages);
    const mostUsedCanonical = this.pickMostUsedCanonical(byCanonical);
    const lastUsedCanonical = this.pickLastUsedCanonical(byCanonical);
    const suggestedCanonicals = this.pickSuggestedCanonicals(byCanonical, [mostUsedCanonical, lastUsedCanonical]);
    const popularCanonicals = this.pickPopularCanonicals(byCanonical, [mostUsedCanonical, lastUsedCanonical, ...suggestedCanonicals]);
    const ordered = this.reorder(
      languages,
      byCanonical,
      [mostUsedCanonical, lastUsedCanonical, ...suggestedCanonicals, ...popularCanonicals],
    );
    return {
      languages: ordered,
      mostUsedCode: this.codeOf(byCanonical, mostUsedCanonical),
      lastUsedCode: this.codeOf(byCanonical, lastUsedCanonical),
    };
  }

  private indexByCanonical(languages: readonly SupportedLanguage[]): ReadonlyMap<string, SupportedLanguage> {
    const map = new Map<string, SupportedLanguage>();
    for (const lang of languages) {
      const canonical = this.canonicalCodeResolver.of(lang);
      if (canonical === undefined) continue;
      if (!map.has(canonical)) map.set(canonical, lang);
    }
    return map;
  }

  private pickMostUsedCanonical(byCanonical: ReadonlyMap<string, SupportedLanguage>): string | null {
    let best: string | null = null;
    let bestCount = 0;
    for (const [canonical, count] of this.usage.counts()) {
      if (count > bestCount && byCanonical.has(canonical)) {
        best = canonical;
        bestCount = count;
      }
    }
    return best;
  }

  private pickLastUsedCanonical(byCanonical: ReadonlyMap<string, SupportedLanguage>): string | null {
    const canonical = this.usage.lastPickedCanonicalCode();
    if (canonical === null || !byCanonical.has(canonical)) return null;
    return canonical;
  }

  private pickSuggestedCanonicals(
    byCanonical: ReadonlyMap<string, SupportedLanguage>,
    excluded: readonly (string | null)[],
  ): readonly string[] {
    const excludedSet = new Set(excluded.filter((c): c is string => c !== null));
    const suggested: string[] = [];
    for (const canonical of this.locale.suggestedLanguageCodes()) {
      if (excludedSet.has(canonical)) continue;
      if (!byCanonical.has(canonical)) continue;
      suggested.push(canonical);
    }
    return suggested;
  }

  private pickPopularCanonicals(
    byCanonical: ReadonlyMap<string, SupportedLanguage>,
    excluded: readonly (string | null)[],
  ): readonly string[] {
    const excludedSet = new Set(excluded.filter((c): c is string => c !== null));
    const popular: string[] = [];
    for (const canonical of LanguageRanker.POPULAR_CANONICAL_CODES) {
      if (excludedSet.has(canonical)) continue;
      if (!byCanonical.has(canonical)) continue;
      popular.push(canonical);
    }
    return popular;
  }

  private reorder(
    languages: readonly SupportedLanguage[],
    byCanonical: ReadonlyMap<string, SupportedLanguage>,
    prioritizedCanonicals: readonly (string | null)[],
  ): readonly SupportedLanguage[] {
    const ordered: SupportedLanguage[] = [];
    const placedCodes = new Set<string>();
    for (const canonical of prioritizedCanonicals) {
      if (canonical === null) continue;
      const lang = byCanonical.get(canonical);
      if (lang === undefined || placedCodes.has(lang.code)) continue;
      ordered.push(lang);
      placedCodes.add(lang.code);
    }
    for (const lang of languages) {
      if (!placedCodes.has(lang.code)) ordered.push(lang);
    }
    return ordered;
  }

  private codeOf(byCanonical: ReadonlyMap<string, SupportedLanguage>, canonical: string | null): string | null {
    if (canonical === null) return null;
    return byCanonical.get(canonical)?.code ?? null;
  }
}
