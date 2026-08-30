import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import {
  IndexedDbLruProjectCache,
  type ProjectCacheEntry,
} from '@core/_shared/infrastructure/IndexedDbLruProjectCache';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';

const STORE = 'video-proxies';

interface ProxyEntry extends ProjectCacheEntry {
  readonly blob: Blob;
  readonly mimeType: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * `PreviewProxyRepository` backed by the shared `video-proxies`
 * IndexedDB store, holding the proxies of the `maxCachedProjects`
 * most recently read projects.
 *
 * `maxCachedProjects` has to match the source-video cache's: a proxy
 * without its source opens the editor on a project it cannot export,
 * and the fast path relies on the two evicting together.
 */
export class IndexedDbPreviewProxyRepository implements PreviewProxyRepository {
  private readonly entries: IndexedDbLruProjectCache<ProxyEntry>;

  constructor(db: IndexedDbClient, maxCachedProjects: number) {
    this.entries = new IndexedDbLruProjectCache<ProxyEntry>(db, STORE, maxCachedProjects);
  }

  async load(projectId: string): Promise<PreviewProxy | null> {
    const entry = await this.entries.read(projectId);
    if (!entry) return null;
    return this.toProxy(entry);
  }

  store(projectId: string, proxy: PreviewProxy): Promise<void> {
    return this.entries.write(projectId, {
      blob: proxy.blob,
      mimeType: proxy.mimeType,
      widthPx: proxy.widthPx,
      heightPx: proxy.heightPx,
    });
  }

  delete(projectId: string): Promise<void> {
    return this.entries.delete(projectId);
  }

  private toProxy(entry: ProxyEntry): PreviewProxy {
    return {
      blob: entry.blob,
      mimeType: entry.mimeType,
      widthPx: entry.widthPx,
      heightPx: entry.heightPx,
    };
  }
}
