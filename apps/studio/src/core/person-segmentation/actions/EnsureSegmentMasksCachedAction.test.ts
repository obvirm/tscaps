import { describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';
import type { HiddenVideoLoader } from '@core/person-segmentation/services/HiddenVideoLoader';
import { PassingWindowFinder } from '@core/person-segmentation/services/PassingWindowFinder';
import { PersonSegmentationCachePersister } from '@core/person-segmentation/services/PersonSegmentationCachePersister';
import { PersonSegmentationResultAssembler } from '@core/person-segmentation/services/PersonSegmentationResultAssembler';
import { PersonSegmentationResultReader } from '@core/person-segmentation/services/PersonSegmentationResultReader';
import { ScanVideoSourceResolver } from '@core/person-segmentation/services/ScanVideoSourceResolver';
import type { PersonMaskCapturer } from '@core/person-segmentation/infrastructure/PersonMaskCapturer';
import type { PersonSegmenterWorkerClient } from '@core/person-segmentation/infrastructure/PersonSegmenterWorkerClient';
import { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';
import { SegmentMaskBackfillStore } from '@core/person-segmentation/store/SegmentMaskBackfillStore';
import { EnsureSegmentMasksCachedAction } from '@core/person-segmentation/actions/EnsureSegmentMasksCachedAction';

/**
 * Capturing masks for a segment the user pinned the effect to by hand.
 *
 * The capture is slow — a hidden video, a seek and an inference per
 * timestamp — and it does not have the video to itself. The background
 * analysis publishes a chunk every few seconds, so a record read before
 * the capture started is stale by the time it ends, and republishing it
 * would take back whatever was measured in between: the captions in
 * that stretch would stop lifting, the preview would go back to holding
 * playback over ground already covered, and the write that follows
 * would put all of that in storage.
 *
 * The other direction is the older trap, and still live: masks are
 * captured for one pinned segment wherever it sits, so they say nothing
 * about whether the scenes around them were ever examined. A backfill
 * that claimed coverage would bury the scan that is still owed.
 */

const PROJECT_ID = 'project-1';
const PINNED_SEGMENT_RANGE = { start: 20, end: 20.1 };
const MEASURED_CHUNK = TimeRangeSet.of([{ start: 0, end: 10 }]);
const CHUNK_MASK_TIME = 1;

const assembler = new PersonSegmentationResultAssembler(new PassingWindowFinder());

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

function maskAt(timestamp: number): { t: number; alpha: Uint8Array; width: number; height: number } {
  return { t: timestamp, alpha: new Uint8Array([255]), width: 1, height: 1 };
}

/** What a background chunk leaves behind: a stretch examined, a scene found in it, and masks inside that scene. */
function chunkOverTheOpeningOfTheVideo(): PersonSegmentationResult {
  const masks = new MaskCache();
  masks.add(maskAt(CHUNK_MASK_TIME));
  const samples = [];
  for (let t = 0; t <= 10; t++) samples.push({ t, passes: true });
  return assembler.assemble(MEASURED_CHUNK, samples, masks);
}

function maskTimes(result: PersonSegmentationResult): number[] {
  return result.maskCache.toArray().map((mask) => mask.t);
}

interface BackfillUnderTest {
  readonly action: EnsureSegmentMasksCachedAction;
  readonly loadedStore: LoadedPersonSegmentationCacheStore;
  readonly repository: InMemoryPersonSegmentationCacheRepository;
}

/**
 * A backfill whose capture takes long enough for `whileCapturing` to
 * run — which is where a test stands the background analysis up.
 */
function backfillInterruptedBy(whileCapturing: () => void): BackfillUnderTest {
  const editorStore = new EditorStore();
  editorStore.patch({ projectId: PROJECT_ID, video: { url: 'blob:the-video' } });
  const repository = new InMemoryPersonSegmentationCacheRepository();
  const loadedStore = new LoadedPersonSegmentationCacheStore();
  const maskCapturer = {
    captureAtTimestamps: async (
      _video: HTMLVideoElement,
      timestamps: ReadonlyArray<number>,
    ): Promise<MaskCache> => {
      whileCapturing();
      const captured = new MaskCache();
      for (const timestamp of timestamps) captured.add(maskAt(timestamp));
      return captured;
    },
  } as unknown as PersonMaskCapturer;
  const action = new EnsureSegmentMasksCachedAction(
    editorStore,
    new ScanVideoSourceResolver(),
    { load: async () => ({}) as HTMLVideoElement, dispose: () => {} } as unknown as HiddenVideoLoader,
    { ensureReady: async () => undefined } as unknown as PersonSegmenterWorkerClient,
    maskCapturer,
    new PersonSegmentationCachePersister(repository, loadedStore),
    new PersonSegmentationResultReader(repository, loadedStore),
    assembler,
    loadedStore,
    new SegmentMaskBackfillStore(),
  );
  return { action, loadedStore, repository };
}

describe('capturing masks for a segment the user pinned the effect to by hand', () => {
  it('keeps the stretch a background chunk measured while it was capturing', async () => {
    const { action, loadedStore } = backfillInterruptedBy(
      () => loadedStore.publish(PROJECT_ID, chunkOverTheOpeningOfTheVideo()),
    );

    await action.execute({ segmentId: 'segment-1', range: PINNED_SEGMENT_RANGE });

    expect(loadedStore.current!.result.analyzedRanges.list()).toEqual(MEASURED_CHUNK.list());
  });

  it('keeps the scenes that chunk found, so segments already lifting do not stop', async () => {
    const { action, loadedStore } = backfillInterruptedBy(
      () => loadedStore.publish(PROJECT_ID, chunkOverTheOpeningOfTheVideo()),
    );

    await action.execute({ segmentId: 'segment-1', range: PINNED_SEGMENT_RANGE });

    expect(loadedStore.current!.result.windows).toEqual([{ start: 0, end: 10 }]);
  });

  it('keeps the masks that chunk captured alongside the ones it captured itself', async () => {
    const { action, loadedStore } = backfillInterruptedBy(
      () => loadedStore.publish(PROJECT_ID, chunkOverTheOpeningOfTheVideo()),
    );

    await action.execute({ segmentId: 'segment-1', range: PINNED_SEGMENT_RANGE });

    const times = maskTimes(loadedStore.current!.result);
    expect(times).toContain(CHUNK_MASK_TIME);
    expect(times).toContain(PINNED_SEGMENT_RANGE.start);
  });

  it('writes the chunk it found waiting rather than the record it started from', async () => {
    const { action, loadedStore, repository } = backfillInterruptedBy(
      () => loadedStore.publish(PROJECT_ID, chunkOverTheOpeningOfTheVideo()),
    );

    await action.execute({ segmentId: 'segment-1', range: PINNED_SEGMENT_RANGE });

    const stored = await repository.load(PROJECT_ID);
    expect(stored!.analyzedRanges.list()).toEqual(MEASURED_CHUNK.list());
    expect(maskTimes(stored!)).toContain(CHUNK_MASK_TIME);
  });

  it('claims no coverage of its own, so the scan it cannot stand in for stays owed', async () => {
    const { action, loadedStore } = backfillInterruptedBy(() => {});

    await action.execute({ segmentId: 'segment-1', range: PINNED_SEGMENT_RANGE });

    expect(loadedStore.current!.result.analyzedRanges.isEmpty()).toBe(true);
    expect(loadedStore.current!.result.covers(TimeRangeSet.of([PINNED_SEGMENT_RANGE]))).toBe(false);
  });
});
