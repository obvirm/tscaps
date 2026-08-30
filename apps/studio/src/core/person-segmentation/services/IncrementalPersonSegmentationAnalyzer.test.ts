import { describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';
import type { AnalyzeVideoRangesAction } from '@core/person-segmentation/actions/AnalyzeVideoRangesAction';
import type { PersonSegmentationCachePersister } from '@core/person-segmentation/services/PersonSegmentationCachePersister';
import type { PersonSegmentationResultReader } from '@core/person-segmentation/services/PersonSegmentationResultReader';
import type { PersonSegmentationSession } from '@core/person-segmentation/services/PersonSegmentationSession';
import { ScanVideoSourceResolver } from '@core/person-segmentation/services/ScanVideoSourceResolver';
import { IncrementalPersonSegmentationAnalyzer } from '@core/person-segmentation/services/IncrementalPersonSegmentationAnalyzer';

/**
 * Measuring a video a chunk at a time while someone edits it.
 *
 * The detector admits one run at a time, and the two ways in arrive
 * independently: a background pass working through what is owed, and a
 * caller wanting the moment on screen ready now. Switching sheets does
 * exactly that — the pass from the sheet just left is still going when
 * the new one asks for its head start — so the two have to take turns
 * rather than collide.
 *
 * The other thing being pinned down here is what happens when a chunk
 * cannot be measured at all. Somebody is always waiting on the answer,
 * and the honest one is "no": a caller told the video is covered when
 * it is not burns a file without the effect, and a preview that keeps
 * waiting for a measurement that will never arrive is an editor nobody
 * can use.
 */

const WHOLE_VIDEO = TimeRangeSet.of([{ start: 0, end: 120 }]);

/** Stands in for the detector's one-run-at-a-time rule, and reports how deep the overlap got. */
class ExclusiveAnalysis {
  private inFlight = 0;
  deepestOverlap = 0;
  runs = 0;
  failEveryRun = false;

  readonly action = {
    execute: async (): Promise<void> => {
      this.inFlight++;
      this.runs++;
      this.deepestOverlap = Math.max(this.deepestOverlap, this.inFlight);
      await Promise.resolve();
      this.inFlight--;
      if (this.failEveryRun) throw new Error('the detector could not read this stretch');
    },
  } as unknown as AnalyzeVideoRangesAction;
}

/** Counts how often what was learned is written out, which is the whole point of batching it. */
class CountingPersister {
  flushes = 0;

  readonly persister = {
    markDirty: (): void => {},
    flush: async (): Promise<void> => { this.flushes++; },
  } as unknown as PersonSegmentationCachePersister;
}

interface AnalyzerUnderTest {
  readonly analyzer: IncrementalPersonSegmentationAnalyzer;
  readonly editorStore: EditorStore;
  readonly closedSessions: () => number;
}

function analyzerOver(analysis: ExclusiveAnalysis, persister = new CountingPersister()): AnalyzerUnderTest {
  const editorStore = new EditorStore();
  editorStore.patch({ video: { url: 'blob:the-video' } });
  let closed = 0;
  const session = {
    open: async () => ({}) as HTMLVideoElement,
    close: () => { closed++; },
  } as unknown as PersonSegmentationSession;
  const analyzer = new IncrementalPersonSegmentationAnalyzer(
    editorStore,
    session,
    analysis.action,
    { read: async () => null } as unknown as PersonSegmentationResultReader,
    new ScanVideoSourceResolver(),
    persister.persister,
  );
  return { analyzer, editorStore, closedSessions: () => closed };
}

describe('measuring a video a chunk at a time while someone edits it', () => {
  it('never has two chunks in flight at once', async () => {
    const analysis = new ExclusiveAnalysis();
    const { analyzer } = analyzerOver(analysis);
    analyzer.request(WHOLE_VIDEO);

    await Promise.all([analyzer.analyzeNextChunk(), analyzer.analyzeNextChunk(), analyzer.analyzeNextChunk()]);

    expect(analysis.deepestOverlap).toBe(1);
  });

  it('lets a head start wait its turn behind a background pass already running', async () => {
    const analysis = new ExclusiveAnalysis();
    const { analyzer } = analyzerOver(analysis);
    analyzer.request(WHOLE_VIDEO);
    const background = analyzer.drain();

    await analyzer.ensureHeadStart(WHOLE_VIDEO);
    await background;

    expect(analysis.deepestOverlap).toBe(1);
  });

  it('works the whole video off and then stops asking', async () => {
    const analysis = new ExclusiveAnalysis();
    const { analyzer } = analyzerOver(analysis);
    analyzer.request(WHOLE_VIDEO);

    await analyzer.drain();

    expect(analyzer.hasWorkLeft()).toBe(false);
    expect(analysis.runs).toBeGreaterThan(1);
  });

  it('writes what it learned once the work runs out, not once per chunk', async () => {
    const analysis = new ExclusiveAnalysis();
    const persister = new CountingPersister();
    const { analyzer } = analyzerOver(analysis, persister);
    analyzer.request(WHOLE_VIDEO);

    await analyzer.drain();

    expect(analysis.runs).toBeGreaterThan(1);
    expect(persister.flushes).toBe(1);
  });

  it('says so when a stretch could not be measured, instead of reporting it covered', async () => {
    const analysis = new ExclusiveAnalysis();
    analysis.failEveryRun = true;
    const { analyzer } = analyzerOver(analysis);

    expect(await analyzer.ensureCovered(WHOLE_VIDEO)).toBe(false);
  });

  it('gives up rather than retrying a stretch that keeps failing', async () => {
    const analysis = new ExclusiveAnalysis();
    analysis.failEveryRun = true;
    const { analyzer } = analyzerOver(analysis);

    await analyzer.ensureCovered(WHOLE_VIDEO);

    expect(analysis.runs).toBe(1);
  });

  it('keeps a stretch it failed on owed, so asking again measures it', async () => {
    const analysis = new ExclusiveAnalysis();
    const { analyzer } = analyzerOver(analysis);
    analysis.failEveryRun = true;
    await analyzer.ensureCovered(WHOLE_VIDEO);

    analysis.failEveryRun = false;

    expect(await analyzer.ensureCovered(WHOLE_VIDEO)).toBe(true);
  });

  it('reports a stretch covered once nothing of it is owed', async () => {
    const analysis = new ExclusiveAnalysis();
    const { analyzer } = analyzerOver(analysis);

    expect(await analyzer.ensureCovered(WHOLE_VIDEO)).toBe(true);
  });

  it('drops what it owed for a video that has been swapped out from under it', async () => {
    const analysis = new ExclusiveAnalysis();
    const { analyzer, editorStore } = analyzerOver(analysis);
    analyzer.request(WHOLE_VIDEO);

    editorStore.patch({ video: { url: 'blob:a-different-video' } });
    await analyzer.drain();

    expect(analysis.runs).toBe(0);
    expect(analyzer.hasWorkLeft()).toBe(false);
  });

  it('closes the video it was decoding when it is told to stop', () => {
    const analysis = new ExclusiveAnalysis();
    const { analyzer, closedSessions } = analyzerOver(analysis);

    analyzer.stop();

    expect(closedSessions()).toBe(1);
  });
});
