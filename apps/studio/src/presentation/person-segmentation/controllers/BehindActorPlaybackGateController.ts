import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PlaybackGate } from '@core/person-segmentation/domain/PlaybackGate';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';
import type { CaptionedRangeCollector } from '@core/person-segmentation/services/CaptionedRangeCollector';
import type { IncrementalPersonSegmentationAnalyzer } from '@core/person-segmentation/services/IncrementalPersonSegmentationAnalyzer';
import type { BehindActorAnalysisGateStore } from '@core/person-segmentation/store/BehindActorAnalysisGateStore';
import type { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';

/**
 * Holds the video wherever it reaches a caption nobody has measured
 * yet, and lets it go once the measurement arrives.
 *
 * The preview cannot show an unmeasured caption as un-lifted: an
 * export finishes the measurement before it burns, so the two would
 * show different things for the same frame. Stopping is what keeps
 * that from happening — it is the mechanism, not a courtesy.
 *
 * The hold applies wherever the playhead is parked, playing or not,
 * because a frame someone is looking at is a frame they are reading as
 * finished. That makes the playhead the thing to watch, and it moves
 * on its own channel: a video playing through an unmeasured caption
 * changes nothing else about the editor, and a gate listening only for
 * editor changes would sleep through exactly the case it exists for.
 * It applies only where a caption that could use the effect actually
 * sits — a scene painted with a template that does not ask for it is
 * never held, and the background pass keeps going underneath.
 *
 * A video that was running when the hold went on is handed back
 * running when it comes off; one that was paused stays paused.
 *
 * A stretch the detector cannot measure is given up on rather than
 * held forever: the alternative is an editor with the preview veiled
 * and playback pinned, and no way out. What it costs is nothing, since
 * an export hitting the same failure also burns the effect off — the
 * two still agree.
 */
export class BehindActorPlaybackGateController {
  private heldWhilePlaying = false;
  private abandoned = TimeRangeSet.EMPTY;

  constructor(
    private readonly editorStore: EditorStore,
    private readonly loadedCacheStore: LoadedPersonSegmentationCacheStore,
    private readonly captionedRanges: CaptionedRangeCollector,
    private readonly analyzer: IncrementalPersonSegmentationAnalyzer,
    private readonly gateStore: BehindActorAnalysisGateStore,
    private readonly playback: PlaybackGate,
  ) {}

  start(): void {
    this.editorStore.addEventListener('change', this.onChange);
    this.editorStore.addEventListener('timechange', this.onChange);
    this.loadedCacheStore.addEventListener('change', this.onChange);
    this.evaluate();
  }

  stop(): void {
    this.editorStore.removeEventListener('change', this.onChange);
    this.editorStore.removeEventListener('timechange', this.onChange);
    this.loadedCacheStore.removeEventListener('change', this.onChange);
    this.heldWhilePlaying = false;
    this.gateStore.set(false);
  }

  private readonly onChange = (): void => this.evaluate();

  private evaluate(): void {
    const unmeasured = this.unmeasuredCaptionsHere();
    if (unmeasured === null) {
      this.release();
      return;
    }
    if (this.gateStore.blocked) return;
    // Whether the video was running is the only thing the hold has to
    // remember: it is what tells release to hand playback back rather
    // than start it under someone who had it paused.
    this.heldWhilePlaying = this.playback.isPlaying();
    this.gateStore.set(true);
    this.playback.pause();
    // The queue orders itself by the playhead, so once the work is in
    // it there is nothing to re-ask for on every tick.
    void this.measure(unmeasured);
  }

  private async measure(unmeasured: TimeRangeSet): Promise<void> {
    try {
      if (!await this.analyzer.ensureCovered(unmeasured)) this.giveUpOn(unmeasured);
    } catch (error) {
      console.error('[behind-actor] could not measure the captions on screen', error);
      this.giveUpOn(unmeasured);
    }
    this.evaluate();
  }

  private giveUpOn(ranges: TimeRangeSet): void {
    this.abandoned = TimeRangeSet.of([...this.abandoned.list(), ...ranges.list()]);
  }

  private release(): void {
    if (!this.gateStore.blocked) return;
    this.gateStore.set(false);
    if (!this.heldWhilePlaying) return;
    this.heldWhilePlaying = false;
    void this.playback.play().catch(() => undefined);
  }

  /**
   * The captions still owed a measurement, when the playhead is
   * sitting on one of them, or `null` when there is nothing to wait
   * for here.
   */
  private unmeasuredCaptionsHere(): TimeRangeSet | null {
    const snapshot = this.editorStore.snapshot();
    const now = snapshot.video.currentTime;
    if (this.abandoned.containsInstant(now)) return null;
    const captions = this.captionedRanges.collect(snapshot.document, snapshot.sheets);
    if (!captions.containsInstant(now)) return null;
    const entry = this.loadedCacheStore.current;
    const known = entry !== null && entry.projectId === snapshot.projectId ? entry.result : null;
    if (known !== null && known.analyzedRanges.containsInstant(now)) return null;
    return known === null ? captions : known.missingFrom(captions);
  }
}
