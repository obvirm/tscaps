import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import type { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';

/**
 * Writes the detector result to storage once a stretch of work is
 * done, rather than once per stretch.
 *
 * A record carries every mask captured for the video so far, and the
 * masks are most of its weight — a minute of captioned video runs to
 * tens of megabytes. Storing after every chunk rewrites all of it
 * every few seconds, so the bytes written grow with the square of the
 * video's length while the record itself grows linearly. Marking the
 * project instead and writing when the work runs out keeps the record
 * complete for one write.
 *
 * What is written is whatever the in-memory slot holds at that moment,
 * never a snapshot taken when the mark was made: a mask backfill can
 * land between the two, and writing the older of the two records would
 * drop its masks. A mark for a session with no persisted project id
 * stands for "nothing to write" — those results live in memory alone.
 *
 * Work marked but not yet written is lost if the tab goes away, which
 * costs a re-measure of those stretches and nothing else.
 */
export class PersonSegmentationCachePersister {
  private dirtyProjectId: string | null = null;

  constructor(
    private readonly cacheRepository: PersonSegmentationCacheRepository,
    private readonly loadedStore: LoadedPersonSegmentationCacheStore,
  ) {}

  /** Records that `projectId` has knowledge worth writing. */
  markDirty(projectId: string | null): void {
    if (projectId === null) return;
    this.dirtyProjectId = projectId;
  }

  /**
   * Writes the marked project's current result, if any. Resolves once
   * the write has landed. A failed write leaves the project marked, so
   * the next flush tries again; it never rejects.
   */
  async flush(): Promise<void> {
    const projectId = this.dirtyProjectId;
    if (projectId === null) return;
    this.dirtyProjectId = null;
    const entry = this.loadedStore.current;
    if (entry === null || entry.projectId !== projectId) return;
    try {
      await this.cacheRepository.store(projectId, entry.result);
    } catch (error) {
      this.dirtyProjectId ??= projectId;
      console.error('[person-segmentation] failed to store the detector cache', error);
    }
  }
}
