import { describe, expect, it } from 'vitest';
import type { Document } from '@tscaps/engine';
import { EditorStore } from '@core/editor/store/EditorStore';
import { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import type { PlaybackGate } from '@core/person-segmentation/domain/PlaybackGate';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { CaptionedRangeCollector } from '@core/person-segmentation/services/CaptionedRangeCollector';
import type { IncrementalPersonSegmentationAnalyzer } from '@core/person-segmentation/services/IncrementalPersonSegmentationAnalyzer';
import { PassingWindowFinder } from '@core/person-segmentation/services/PassingWindowFinder';
import { PersonSegmentationResultAssembler } from '@core/person-segmentation/services/PersonSegmentationResultAssembler';
import { BehindActorAnalysisGateStore } from '@core/person-segmentation/store/BehindActorAnalysisGateStore';
import { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';
import { BehindActorPlaybackGateController } from '@presentation/person-segmentation/controllers/BehindActorPlaybackGateController';

/**
 * Holding the video where nobody has measured what it shows.
 *
 * The frame on screen is the whole question, so the playhead is what
 * the hold watches — and a playing video moves it without changing
 * anything else about the editor. Playing straight through an
 * unmeasured caption is the failure this exists to prevent: the
 * preview would show the caption sitting where it always sits while
 * the export, which finishes measuring first, lifts it.
 *
 * The hold also has to end. It ends when the measurement lands, and it
 * ends when the measurement turns out to be impossible — an editor
 * pinned on a frame that will never be measured is worse than a
 * preview that admits it does not know, and an export hitting the same
 * wall drops the effect too, so the two still agree.
 */

const SHEET_ID = 'main';
const PROJECT_ID = 'project-1';

const assembler = new PersonSegmentationResultAssembler(new PassingWindowFinder());

function sheetWantingTheEffect(): Sheet {
  return { id: SHEET_ID, template: { behindActor: { required: true } } } as unknown as Sheet;
}

function documentWithCaptionOver(start: number, end: number): Document {
  return { sections: [{ kind: SHEET_ID, segments: [{ time: { start, end } }] }] } as unknown as Document;
}

/** Stands in for the preview surface, and remembers what was asked of it. */
class RecordedPlayback implements PlaybackGate {
  playing = false;
  pauses = 0;
  plays = 0;

  async play(): Promise<void> {
    this.plays++;
    this.playing = true;
  }

  pause(): void {
    this.pauses++;
    this.playing = false;
  }

  isPlaying(): boolean {
    return this.playing;
  }
}

/** Stands in for the detector, so a test decides whether the measurement lands. */
class StubAnalyzer {
  covered = true;
  asked: TimeRangeSet[] = [];

  readonly analyzer = {
    ensureCovered: async (ranges: TimeRangeSet): Promise<boolean> => {
      this.asked.push(ranges);
      return this.covered;
    },
  } as unknown as IncrementalPersonSegmentationAnalyzer;
}

interface GateUnderTest {
  readonly editorStore: EditorStore;
  readonly loadedCacheStore: LoadedPersonSegmentationCacheStore;
  readonly gateStore: BehindActorAnalysisGateStore;
  readonly playback: RecordedPlayback;
  readonly stubAnalyzer: StubAnalyzer;
}

function startedGate(): GateUnderTest {
  const editorStore = new EditorStore();
  editorStore.patch({
    projectId: PROJECT_ID,
    sheets: [sheetWantingTheEffect()],
    activeSheetId: SHEET_ID,
    document: documentWithCaptionOver(4, 6),
  });
  const loadedCacheStore = new LoadedPersonSegmentationCacheStore();
  const gateStore = new BehindActorAnalysisGateStore();
  const playback = new RecordedPlayback();
  const stubAnalyzer = new StubAnalyzer();
  new BehindActorPlaybackGateController(
    editorStore,
    loadedCacheStore,
    new CaptionedRangeCollector(),
    stubAnalyzer.analyzer,
    gateStore,
    playback,
  ).start();
  return { editorStore, loadedCacheStore, gateStore, playback, stubAnalyzer };
}

function publishCoverageOver(loadedCacheStore: LoadedPersonSegmentationCacheStore, start: number, end: number): void {
  loadedCacheStore.publish(
    PROJECT_ID,
    assembler.assemble(TimeRangeSet.of([{ start, end }]), [], new MaskCache()),
  );
}

/** Lets the hold's own measurement round settle before the assertion reads the outcome. */
function afterTheGateHasSettled(): Promise<void> {
  return Promise.resolve().then(() => undefined).then(() => undefined);
}

describe('holding the video where nobody has measured what it shows', () => {
  it('stops a playing video when it reaches an unmeasured caption', () => {
    const { editorStore, playback, gateStore } = startedGate();
    playback.playing = true;

    editorStore.setCurrentTime(5);

    expect(gateStore.blocked).toBe(true);
    expect(playback.pauses).toBe(1);
  });

  it('stays out of the way where no caption sits', () => {
    const { editorStore, playback, gateStore } = startedGate();
    playback.playing = true;

    editorStore.setCurrentTime(1);

    expect(gateStore.blocked).toBe(false);
    expect(playback.pauses).toBe(0);
  });

  it('holds a parked playhead too, since that frame is being read as finished', () => {
    const { editorStore, gateStore } = startedGate();

    editorStore.setCurrentTime(5);

    expect(gateStore.blocked).toBe(true);
  });

  it('hands playback back running once the measurement lands', async () => {
    const { editorStore, loadedCacheStore, playback, gateStore } = startedGate();
    playback.playing = true;
    editorStore.setCurrentTime(5);

    publishCoverageOver(loadedCacheStore, 0, 10);
    await afterTheGateHasSettled();

    expect(gateStore.blocked).toBe(false);
    expect(playback.plays).toBe(1);
  });

  it('leaves a video that was paused paused once the measurement lands', async () => {
    const { editorStore, loadedCacheStore, playback, gateStore } = startedGate();
    editorStore.setCurrentTime(5);

    publishCoverageOver(loadedCacheStore, 0, 10);
    await afterTheGateHasSettled();

    expect(gateStore.blocked).toBe(false);
    expect(playback.plays).toBe(0);
  });

  it('lets go rather than waiting forever on a stretch that cannot be measured', async () => {
    const { editorStore, stubAnalyzer, gateStore } = startedGate();
    stubAnalyzer.covered = false;

    editorStore.setCurrentTime(5);
    await afterTheGateHasSettled();

    expect(gateStore.blocked).toBe(false);
  });

  it('does not take the video hostage again over a stretch it already gave up on', async () => {
    const { editorStore, stubAnalyzer, playback, gateStore } = startedGate();
    stubAnalyzer.covered = false;
    editorStore.setCurrentTime(5);
    await afterTheGateHasSettled();
    const pausesBefore = playback.pauses;

    editorStore.setCurrentTime(5.5);
    await afterTheGateHasSettled();

    expect(gateStore.blocked).toBe(false);
    expect(playback.pauses).toBe(pausesBefore);
  });

  it('asks for the measurement once, not once per frame the playhead crosses', () => {
    const { editorStore, stubAnalyzer } = startedGate();

    editorStore.setCurrentTime(4.5);
    editorStore.setCurrentTime(5);
    editorStore.setCurrentTime(5.5);

    expect(stubAnalyzer.asked).toHaveLength(1);
  });
});
