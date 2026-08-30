import type { LocalStorageClient } from '@core/_shared/infrastructure/LocalStorageClient';
import type { SupportedLanguage } from '@shared/transcription-languages';
import type { LanguageUsageRepository } from '@core/preprocessing/domain/LanguageUsageRepository';
import type { LanguageCanonicalCodeResolver } from '@core/preprocessing/services/LanguageCanonicalCodeResolver';

const KEY = 'language-usage';

interface PersistedShape {
  readonly counts: Record<string, number>;
  readonly lastPickedCanonicalCode: string | null;
}

/**
 * localStorage-backed implementation. Reads validate every field so a
 * corrupted or hand-edited value falls back to empty state rather than
 * propagating garbage into the ranker. Reads also accept the flat
 * `Record<code, number>` shape that earlier versions of this repo
 * wrote, so an upgrade does not wipe the user's pick history.
 */
export class LocalStorageLanguageUsageRepository implements LanguageUsageRepository {

  constructor(
    private readonly storage: LocalStorageClient,
    private readonly canonicalCodeResolver: LanguageCanonicalCodeResolver,
  ) {}

  counts(): ReadonlyMap<string, number> {
    const persisted = this.readPersisted();
    const map = new Map<string, number>();
    for (const [code, value] of Object.entries(persisted.counts)) {
      if (!this.isValidCanonicalCode(code)) continue;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) continue;
      map.set(code, Math.floor(value));
    }
    return map;
  }

  lastPickedCanonicalCode(): string | null {
    return this.readPersisted().lastPickedCanonicalCode;
  }

  recordPick(language: SupportedLanguage): void {
    const canonical = this.canonicalCodeResolver.of(language);
    if (canonical === undefined) return;
    const persisted = this.readPersisted();
    const nextCounts: Record<string, number> = { ...persisted.counts };
    nextCounts[canonical] = (nextCounts[canonical] ?? 0) + 1;
    this.storage.set<PersistedShape>(KEY, {
      counts: nextCounts,
      lastPickedCanonicalCode: canonical,
    });
  }

  private readPersisted(): PersistedShape {
    const raw = this.storage.get<Record<string, unknown>>(KEY);
    if (raw === null || typeof raw !== 'object') {
      return { counts: {}, lastPickedCanonicalCode: null };
    }
    if (this.isCurrentShape(raw)) {
      return {
        counts: this.sanitizeCounts(raw.counts as Record<string, unknown>),
        lastPickedCanonicalCode: this.sanitizeLastPickedCode(raw.lastPickedCanonicalCode),
      };
    }
    return {
      counts: this.sanitizeCounts(raw),
      lastPickedCanonicalCode: null,
    };
  }

  private isCurrentShape(raw: Record<string, unknown>): boolean {
    return typeof raw.counts === 'object' && raw.counts !== null;
  }

  private sanitizeCounts(raw: Record<string, unknown>): Record<string, number> {
    const clean: Record<string, number> = {};
    for (const [code, value] of Object.entries(raw)) {
      if (!this.isValidCanonicalCode(code)) continue;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) continue;
      clean[code] = Math.floor(value);
    }
    return clean;
  }

  private sanitizeLastPickedCode(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    if (!this.isValidCanonicalCode(raw)) return null;
    return raw;
  }

  private isValidCanonicalCode(code: string): boolean {
    return /^[a-z]{2}$/.test(code);
  }
}
