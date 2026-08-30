import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import type { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';

/**
 * The detector result in force for a project: the published in-memory
 * slot when it belongs to that project, the persisted entry otherwise.
 * Resolves to `null` when neither holds one.
 *
 * Sessions with no persisted project id are served from memory alone —
 * it is the only place their result ever lives, and reaching past it to
 * a repository that cannot answer would report "never scanned" for a
 * scan the user just watched run.
 *
 * Preview and export read the effect's state through this one reader,
 * so what the user sees composited is what gets burned in.
 */
export class PersonSegmentationResultReader {

  constructor(
    private readonly cacheRepository: PersonSegmentationCacheRepository,
    private readonly loadedStore: LoadedPersonSegmentationCacheStore,
  ) {}

  async read(projectId: string | null): Promise<PersonSegmentationResult | null> {
    const loaded = this.loadedStore.current;
    if (loaded !== null && loaded.projectId === projectId) return loaded.result;
    if (projectId === null) return null;
    return await this.cacheRepository.load(projectId);
  }
}
