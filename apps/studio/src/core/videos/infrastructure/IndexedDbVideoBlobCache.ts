import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import {
  IndexedDbLruProjectCache,
  type ProjectCacheEntry,
} from '@core/_shared/infrastructure/IndexedDbLruProjectCache';
import type { VideoBlobCache } from '@core/videos/domain/VideoBlobCache';

const STORE = 'videos';

interface VideoEntry extends ProjectCacheEntry {
  readonly blob: Blob;
}

/**
 * `VideoBlobCache` backed by the shared `videos` IndexedDB store,
 * holding the source bytes of the `maxCachedProjects` most recently
 * read projects so they re-open without prompting a re-select or a
 * re-download.
 */
export class IndexedDbVideoBlobCache implements VideoBlobCache {
  private readonly entries: IndexedDbLruProjectCache<VideoEntry>;

  constructor(db: IndexedDbClient, maxCachedProjects: number) {
    this.entries = new IndexedDbLruProjectCache<VideoEntry>(db, STORE, maxCachedProjects);
  }

  async load(projectId: string): Promise<Blob | null> {
    const entry = await this.entries.read(projectId);
    return entry?.blob ?? null;
  }

  store(projectId: string, blob: Blob): Promise<void> {
    return this.entries.write(projectId, { blob });
  }

  delete(projectId: string): Promise<void> {
    return this.entries.delete(projectId);
  }
}
