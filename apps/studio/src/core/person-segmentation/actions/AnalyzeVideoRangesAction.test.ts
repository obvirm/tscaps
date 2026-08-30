import { describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import type { RunPersonSegmentationAction } from '@core/person-segmentation/actions/RunPersonSegmentationAction';
import { PassingWindowFinder } from '@core/person-segmentation/services/PassingWindowFinder';
import { PersonSegmentationResultAssembler } from '@core/person-segmentation/services/PersonSegmentationResultAssembler';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';
import { PersonSegmentationCachePersister } from '@core/person-segmentation/services/PersonSegmentationCachePersister';
import { PersonSegmentationResultReader } from '@core/person-segmentation/services/PersonSegmentationResultReader';
import { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';
import { AnalyzeVideoRangesAction } from '@core/person-segmentation/actions/AnalyzeVideoRangesAction';

/**
 * Measuring a stretch of video for the actor-cutout effect.
 *
 * A pass answers for the stretch it was asked about and no more, and
 * it is not the only thing that puts masks in the cache: a segment the
 * user pins the effect to by hand gets its own masks captured for it,
 * deliberately outside every scene a pass would pick. Those coexist,
 * so a pass that published only what it measured would take the pinned
 * segment's masks down with it and leave the caption lifted over an
 * actor that is no longer cut out.
 *
 * What a pass writes to storage it writes through the persister, which
 * holds the write back until a stretch of work is done — so these
 * flush by hand to read what would have been written.
 */

const PROJECT_ID = 'project-1';

/** Timestamp of the mask a hand-pinned segment left behind, far outside the scanned window. */
const PINNED_SEGMENT_TIME = 10.5;
const SCANNED_TIME = 1;

class InMemoryPersonSegmentationCacheRepository implements PersonSegmentationCacheRepository {
  private readonly byProject = new Map<string, PersonSegmentationResult>();

  async load(projectId: string): Promise<PersonSegmentationResult | null> {
    return this.byProject.get(projectId) ?? null;
  }

  async store(projectId: string, result: PersonSegmentationResult): Promise<void> {
    this.byProject.set(projectId, result);
  }

  async delete(projectId: string): Promise<void> {
    this.byProject.delete(projectId);
  }
}

function cacheHoldingMaskAt(timestamp: number): MaskCache {
  const cache = new MaskCache();
  cache.add({ t: timestamp, alpha: new Uint8Array([255]), width: 1, height: 1 });
  return cache;
}

const assembler = new PersonSegmentationResultAssembler(new PassingWindowFinder());

/** What a hand-pinned segment leaves behind: masks, and nothing examined. */
function backfillOnlyResult(): PersonSegmentationResult {
  return PersonSegmentationResult.nothingKnown(cacheHoldingMaskAt(PINNED_SEGMENT_TIME));
}

function scanFindingOneWindow(): PersonSegmentationResult {
  return assembler.assemble(
    TimeRangeSet.of([{ start: 0, end: 2 }]),
    [{ t: 0, passes: true }, { t: 2, passes: true }],
    cacheHoldingMaskAt(SCANNED_TIME),
  );
}

function maskTimes(result: PersonSegmentationResult): number[] {
  return result.maskCache.toArray().map((mask) => mask.t);
}

const WHOLE_VIDEO = TimeRangeSet.of([{ start: 0, end: 60 }]);
const OVER_WHOLE_VIDEO = { toScan: WHOLE_VIDEO, toCapture: WHOLE_VIDEO };

/** A pass over the whole video, run and then written out as the background drain would write it. */
async function measureWholeVideo(
  repository: PersonSegmentationCacheRepository,
  loadedStore: LoadedPersonSegmentationCacheStore,
  measured: PersonSegmentationResult,
): Promise<void> {
  const editorStore = new EditorStore();
  editorStore.patch({ projectId: PROJECT_ID });
  const persister = new PersonSegmentationCachePersister(repository, loadedStore);
  const action = new AnalyzeVideoRangesAction(
    editorStore,
    { execute: async () => measured } as unknown as RunPersonSegmentationAction,
    new PersonSegmentationResultReader(repository, loadedStore),
    assembler,
    loadedStore,
    persister,
  );
  await action.execute({} as HTMLVideoElement, OVER_WHOLE_VIDEO);
  await persister.flush();
}

describe('measuring a stretch of video for the actor-cutout effect', () => {
  it('leaves the masks a hand-pinned segment already had in place', async () => {
    const repository = new InMemoryPersonSegmentationCacheRepository();
    await repository.store(PROJECT_ID, backfillOnlyResult());
    const loadedStore = new LoadedPersonSegmentationCacheStore();

    await measureWholeVideo(repository, loadedStore, scanFindingOneWindow());

    const stored = await repository.load(PROJECT_ID);
    expect(maskTimes(stored!)).toEqual([SCANNED_TIME, PINNED_SEGMENT_TIME]);
  });

  it('takes the fresh measurements as the authority on which scenes qualify', async () => {
    const repository = new InMemoryPersonSegmentationCacheRepository();
    await repository.store(PROJECT_ID, backfillOnlyResult());
    const loadedStore = new LoadedPersonSegmentationCacheStore();

    await measureWholeVideo(repository, loadedStore, scanFindingOneWindow());

    const stored = await repository.load(PROJECT_ID);
    expect(stored!.windows).toEqual([{ start: 0, end: 2 }]);
  });

  it('hands the preview and the export the same result', async () => {
    const repository = new InMemoryPersonSegmentationCacheRepository();
    await repository.store(PROJECT_ID, backfillOnlyResult());
    const loadedStore = new LoadedPersonSegmentationCacheStore();

    await measureWholeVideo(repository, loadedStore, scanFindingOneWindow());

    const stored = await repository.load(PROJECT_ID);
    const published = loadedStore.current;
    expect(published?.projectId).toBe(PROJECT_ID);
    expect(published?.result.windows).toEqual(stored!.windows);
    expect(maskTimes(published!.result)).toEqual(maskTimes(stored!));
  });
});
