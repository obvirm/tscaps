import type {
  WordTimeBounds,
  WordTimeLimits,
  WordTimeRange,
} from '@core/captions/services/WordTimeBounds';
import type { TimelineEditingController } from '@presentation/timeline/controllers/TimelineEditingController';
import type { TimelineSnapResolver } from '@presentation/timeline/services/TimelineSnapResolver';

/** Which part of a word the pointer grabbed. */
export type TimelineWordDragMode = 'move' | 'resize-start' | 'resize-end';

export interface TimelineWordDragTarget {
  readonly wordId: string;
  readonly text: string;
  readonly segmentId: string;
  /** Position of the word among its scene's words, in document order. */
  readonly wordIndex: number;
  readonly wordRanges: ReadonlyArray<WordTimeRange>;
  /** Start and end of every scene on the timeline, deduplicated. */
  readonly sceneBoundariesSec: ReadonlyArray<number>;
  /**
   * The window the word's segment is held to — its same-sheet
   * neighbours and the video's ends. A word at either end of its
   * segment has no neighbouring word to stop it, so this is the only
   * thing that does.
   */
  readonly outerLimits: WordTimeLimits;
}

/**
 * Turns pointer movement into a word's new time range: dragging the
 * body slides it, dragging an edge stretches that side.
 *
 * The range only ever lands on the editing controller as a preview.
 * Writing it for real re-runs the whole effects pipeline over the
 * document, which is fine once on release and hopeless once a frame.
 *
 * Neighbouring word edges and every scene's bounds act as landmarks the
 * drag sticks to, so butting a word against something is what happens
 * by default. Past a landmark the word may come to share time with
 * another word of its own scene — two words narrating at once is a
 * legitimate ask — but never to overtake it, and never to carry its
 * scene over one that shares its sheet. The bounds enforce both.
 *
 * The landmarks are the scenes', never the rows': rows are equal slices
 * of the clock and their seams fall wherever the arithmetic puts them,
 * so sticking to one would mean sticking to nothing in the video.
 */
export class TimelineWordEditGesture {

  private target: TimelineWordDragTarget | null = null;
  private mode: TimelineWordDragMode = 'move';
  private limits: WordTimeLimits = {
    earliestStartSec: Number.NEGATIVE_INFINITY,
    latestEndSec: Number.POSITIVE_INFINITY,
  };
  private landmarksSec: number[] = [];
  private originalRange: WordTimeRange = { startSec: 0, endSec: 0 };
  private grabOffsetSec = 0;
  private previewing = false;

  constructor(
    private readonly editing: TimelineEditingController,
    private readonly bounds: WordTimeBounds,
    private readonly snapResolver: TimelineSnapResolver,
    private readonly commit: (wordId: string, startSec: number, endSec: number) => void,
  ) {}

  /** Arms the gesture. Returns false when the target does not describe a real word. */
  begin(target: TimelineWordDragTarget, mode: TimelineWordDragMode, pointerSec: number): boolean {
    const original = target.wordRanges[target.wordIndex];
    if (!original) return false;
    this.target = target;
    this.mode = mode;
    this.originalRange = original;
    this.limits = this.bounds.limitsAt(target.wordRanges, target.wordIndex, target.outerLimits);
    this.landmarksSec = this.collectLandmarks(target);
    this.grabOffsetSec = pointerSec - original.startSec;
    this.previewing = false;
    return true;
  }

  // The preview opens on the first movement, not on the press. A press
  // that never travels is a click on the word, and it should leave the
  // surface exactly as it found it.
  extend(pointerSec: number, secondsPerPixel: number): void {
    const target = this.target;
    if (!target) return;
    if (!this.previewing) {
      this.editing.startWordEdit(
        { wordId: target.wordId, text: target.text, segmentId: target.segmentId },
        this.originalRange,
      );
      this.previewing = true;
    }
    this.editing.updateWordEdit(this.rangeFor(pointerSec, secondsPerPixel));
  }

  /**
   * Applies the previewed range if the word moved. A press that never
   * became a drag selects the word's span instead — the pointer is
   * captured elsewhere for the duration of the gesture, so the press
   * never reaches the word as a click of its own.
   */
  finish(): void {
    const original = this.originalRange;
    const moved = this.previewing;
    const result = moved ? this.editing.endWordEdit() : null;
    this.forget();
    if (!moved) {
      this.editing.selectRange(original.startSec, original.endSec);
      return;
    }
    if (!result) return;
    this.commit(result.wordId, result.range.startSec, result.range.endSec);
  }

  /** Drops the preview without writing anything. */
  cancel(): void {
    if (this.previewing) this.editing.endWordEdit();
    this.forget();
  }

  private forget(): void {
    this.target = null;
    this.previewing = false;
  }

  private rangeFor(pointerSec: number, secondsPerPixel: number): WordTimeRange {
    if (this.mode === 'move') return this.moved(pointerSec, secondsPerPixel);
    if (this.mode === 'resize-start') return this.resizedStart(pointerSec, secondsPerPixel);
    return this.resizedEnd(pointerSec, secondsPerPixel);
  }

  private moved(pointerSec: number, secondsPerPixel: number): WordTimeRange {
    const durationSec = this.originalRange.endSec - this.originalRange.startSec;
    const proposedStartSec = this.snapWholeWord(pointerSec - this.grabOffsetSec, durationSec, secondsPerPixel);
    return this.bounds.shift(this.originalRange, proposedStartSec, this.limits);
  }

  private resizedStart(pointerSec: number, secondsPerPixel: number): WordTimeRange {
    const startSec = this.snapResolver.snap(pointerSec, this.landmarksSec, secondsPerPixel);
    return this.bounds.clamp({ startSec, endSec: this.originalRange.endSec }, this.limits);
  }

  private resizedEnd(pointerSec: number, secondsPerPixel: number): WordTimeRange {
    const endSec = this.snapResolver.snap(pointerSec, this.landmarksSec, secondsPerPixel);
    return this.bounds.clamp({ startSec: this.originalRange.startSec, endSec }, this.limits);
  }

  // A word being slid has two edges that could meet a landmark, and the
  // user is watching whichever one is about to touch. Both are offered
  // and the nearer pull wins.
  private snapWholeWord(proposedStartSec: number, durationSec: number, secondsPerPixel: number): number {
    const proposedEndSec = proposedStartSec + durationSec;
    const snappedStartSec = this.snapResolver.snap(proposedStartSec, this.landmarksSec, secondsPerPixel);
    const snappedEndSec = this.snapResolver.snap(proposedEndSec, this.landmarksSec, secondsPerPixel);
    const startPullSec = Math.abs(snappedStartSec - proposedStartSec);
    const endPullSec = Math.abs(snappedEndSec - proposedEndSec);
    if (endPullSec > 0 && endPullSec < startPullSec) return snappedEndSec - durationSec;
    return snappedStartSec;
  }

  private collectLandmarks(target: TimelineWordDragTarget): number[] {
    const previous = target.wordRanges[target.wordIndex - 1];
    const next = target.wordRanges[target.wordIndex + 1];
    const landmarks = [...target.sceneBoundariesSec];
    if (previous) landmarks.push(previous.startSec, previous.endSec);
    if (next) landmarks.push(next.startSec, next.endSec);
    return landmarks;
  }
}
