import type { ModelFileCache } from '@modules/transcription/ModelFileCache';
import { ModelFileCacheUnavailableError } from '@modules/transcription/ModelFileCacheUnavailableError';

/**
 * Keeps model files in the browser's Cache Storage.
 *
 * Browsers refuse this write far more often than one would expect —
 * an origin over its quota, a private window, a page outside a secure
 * context — and every refusal costs the next run a full re-download of
 * hundreds of megabytes with nothing on screen to explain it. The
 * refusal is therefore handed to `onKeepFailure` instead of being
 * swallowed, while the run in flight carries on regardless: the files
 * are already in memory and the transcription does not need them kept.
 *
 * Only the first refusal of an instance's lifetime is announced. A
 * model is several files and the condition behind a refusal applies to
 * all of them, so the rest would say the same thing again.
 */
export class CacheStorageModelFileCache implements ModelFileCache {

  // The name transformers.js opens by default. Matching it keeps the
  // files downloaded by earlier versions, which used the library's own
  // caching, readable by this one.
  private static readonly CACHE_NAME = 'transformers-cache';

  private opening: Promise<Cache | null> | null = null;
  private failureAnnounced = false;

  /**
   * @param onKeepFailure Called at most once per instance, with the
   * refusal that stopped a file from being kept.
   */
  constructor(private readonly onKeepFailure: (error: unknown) => void) {}

  async match(key: string): Promise<Response | undefined> {
    const cache = await this.open();
    if (!cache) return undefined;
    try {
      return await cache.match(key);
    } catch {
      // A cache that cannot be read is indistinguishable from one that
      // never held the file: both mean it has to be downloaded.
      return undefined;
    }
  }

  async put(key: string, response: Response): Promise<void> {
    const cache = await this.open();
    if (!cache) {
      this.announce(new ModelFileCacheUnavailableError('Cache Storage is not exposed in this context'));
      return;
    }
    try {
      await cache.put(key, response);
    } catch (error) {
      this.announce(error);
    }
  }

  private announce(error: unknown): void {
    if (this.failureAnnounced) return;
    this.failureAnnounced = true;
    this.onKeepFailure(error);
  }

  /**
   * Resolves to `null` when this runtime has no Cache Storage at all,
   * which is a standing condition rather than a transient one — hence
   * the single attempt, reused by every later call.
   */
  private open(): Promise<Cache | null> {
    this.opening ??= this.openOnce();
    return this.opening;
  }

  private async openOnce(): Promise<Cache | null> {
    if (typeof caches === 'undefined') return null;
    try {
      return await caches.open(CacheStorageModelFileCache.CACHE_NAME);
    } catch {
      // Opening is refused outright in some privacy modes. There is
      // nothing to fall back to, and `put` reports the consequence.
      return null;
    }
  }
}
