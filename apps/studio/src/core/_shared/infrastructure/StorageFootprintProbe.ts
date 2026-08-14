import type { TelemetryEventProperties } from '@shared/telemetry';
import type { StoragePersistence } from '@core/_shared/infrastructure/StoragePersistence';

/**
 * Measures how much of the origin's storage allowance is in use, in
 * terms coarse enough to report.
 *
 * A write refused for lack of room has three very different causes
 * and no way to tell them apart from the error alone: a private
 * window (small allowance), our own cached data having filled a
 * normal allowance, or a physically full disk while the reported
 * allowance still looks enormous. Usage against a bucketed quota
 * separates all three.
 *
 * The quota is deliberately reported as a bucket. Chromium derives it
 * from total disk size, so an exact figure is an exact disk size, and
 * that is a fingerprinting signal the browser itself takes care to
 * blunt. Three buckets answer the question without restoring it.
 *
 * Whether the origin's storage is persisted travels alongside, since
 * a reading taken from evictable storage describes a state the
 * browser is free to undo on its own.
 *
 * Measuring is best-effort: an unsupported or failing API yields no
 * properties rather than costing the caller its event.
 */
export class StorageFootprintProbe {

  private static readonly BYTES_PER_MB = 1024 * 1024;
  private static readonly USAGE_ROUNDING_MB = 100;
  private static readonly SMALL_QUOTA_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
  private static readonly MEDIUM_QUOTA_LIMIT_BYTES = 20 * 1024 * 1024 * 1024;

  constructor(private readonly persistence: StoragePersistence) {}

  async measure(): Promise<TelemetryEventProperties> {
    const persisted = { storage_persisted: await this.persistence.isPersisted() };
    const estimate = await this.readEstimate();
    if (!estimate) return persisted;
    const { usage, quota } = estimate;
    if (typeof usage !== 'number' || typeof quota !== 'number' || quota <= 0) return persisted;
    return {
      ...persisted,
      storage_usage_mb: this.roundUsageMb(usage),
      storage_quota_bucket: this.bucketQuota(quota),
      storage_usage_ratio: Math.round((usage / quota) * 100) / 100,
    };
  }

  private async readEstimate(): Promise<StorageEstimate | null> {
    try {
      if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
      return await navigator.storage.estimate();
    } catch {
      // Best-effort: a browser that will not answer costs us the
      // detail, never the event it was meant to enrich.
      return null;
    }
  }

  private roundUsageMb(usage: number): number {
    const step = StorageFootprintProbe.USAGE_ROUNDING_MB;
    return Math.round(usage / StorageFootprintProbe.BYTES_PER_MB / step) * step;
  }

  private bucketQuota(quota: number): string {
    if (quota < StorageFootprintProbe.SMALL_QUOTA_LIMIT_BYTES) return 'under-2gb';
    if (quota < StorageFootprintProbe.MEDIUM_QUOTA_LIMIT_BYTES) return '2gb-to-20gb';
    return 'over-20gb';
  }
}
