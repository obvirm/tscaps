import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import type { VideoBlobCache } from '@core/videos/domain/VideoBlobCache';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';
import { IndexedDbVideoBlobCache } from '@core/videos/infrastructure/IndexedDbVideoBlobCache';
import { MemoryFirstVideoBlobCache } from '@core/videos/infrastructure/MemoryFirstVideoBlobCache';
import { MediaBunnyVideoCompatibilityChecker } from '@core/videos/infrastructure/MediaBunnyVideoCompatibilityChecker';

/**
 * How many projects keep their source video resident in IndexedDB
 * before the least recently opened one is evicted.
 *
 * The preview-proxy cache reads this same number, and has to: the
 * editor's fast path opens a project against its cached proxy and
 * fetches the source in the background, so a proxy that outlives its
 * source opens a project that cannot be exported. Whoever changes
 * this changes both.
 */
export const MAX_CACHED_PROJECT_VIDEOS = 3;

export interface VideosDependencies {
  readonly indexedDb: IndexedDbClient;
}

export interface VideosModule {
  readonly blobCache: VideoBlobCache;
  readonly services: {
    readonly compatibilityChecker: VideoCompatibilityChecker;
  };
}

/**
 * Boots cross-cutting video helpers shared across feature modules:
 * the per-project video blob cache (so a recently opened video
 * re-mounts instantly) and the browser-capability checker that
 * validates a source can flow through the pipeline before any
 * heavy work begins.
 */
export function bootVideos(deps: VideosDependencies): VideosModule {
  return {
    blobCache: new MemoryFirstVideoBlobCache(
      new IndexedDbVideoBlobCache(deps.indexedDb, MAX_CACHED_PROJECT_VIDEOS),
    ),
    services: {
      compatibilityChecker: new MediaBunnyVideoCompatibilityChecker(),
    },
  };
}

/**
 * Returns the videos store schema for the shared IndexedDB
 * connection. The store has no per-version migrations today — the
 * `VideoRecord` shape has been stable since its introduction.
 */
export function buildVideosIndexedDbStoreDefinition(): IndexedDbStoreDefinition {
  return { name: 'videos', keyPath: 'projectId' };
}
