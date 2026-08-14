import { DocumentEditor, TimeFragment } from '@tscaps/engine';
import type { Document } from '@tscaps/engine';
import type { SegmentHardTime } from '@core/captions/services/SegmentHardTime';
import type { SegmentTimeBounds } from '@core/captions/services/SegmentTimeBounds';
import type { WordTimeLimits } from '@core/captions/services/WordTimeBounds';
import type { Segment } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';

const docEditor = new DocumentEditor();

/**
 * Inserts a new empty segment beside the anchor, claiming the room next
 * to it as its time window so the first keystrokes have somewhere to go.
 * In an empty document the first segment claims the whole video instead.
 * Returns the new word id for focus.
 *
 * **The room is measured between the neighbours' hard times**, not
 * between their drawn windows. A drawn window ends wherever gap-free
 * stopped padding, and gap-free stops at `maxGapMs` — a rule about how
 * long a caption lingers, which has nothing to say about how much space
 * a new scene deserves. Reading it left the new segment with whatever
 * the padding declined to eat: for any gap the padding closed outright,
 * a window of **zero width**.
 *
 * **The room is never longer than the anchor itself.** A gap can run to
 * the end of a long video, and a scene born that wide has to be dragged
 * back across every row of the timeline to fix — the cost of a mis-clicked
 * insert scales with the window it opens. The anchor is the reference
 * because it is what the user pointed at: the new scene is born the size
 * of the one it was inserted beside, which needs no constant and follows
 * the document's own pace. An anchor with no width of its own does not
 * cap anything.
 *
 * The first scene of an empty document is the exception and still claims
 * the whole video: with no anchor there is no `+` to have mis-clicked,
 * and the scene it produces is the only one there is to find.
 *
 * Effects are reapplied so neighbours that had been padded across the
 * now-occupied gap settle back against the new segment boundary.
 */
export class InsertSegmentAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
    private readonly videoDurationProvider: () => number,
    private readonly hardTime: SegmentHardTime,
    private readonly segmentBounds: SegmentTimeBounds,
  ) {}

  execute(segIdx: number, position: 'before' | 'after'): string {
    const snap = this.store.snapshot();
    const document = snap.document;
    if (!document) return '';

    const flat = document.getSegments();
    const anchor = flat[segIdx];
    if (!anchor && flat.length > 0) return '';
    const time = anchor
      ? this._roomBeside(document, anchor, position)
      : new TimeFragment(0, this.videoDurationProvider());

    const { doc, wordId, segmentId } = docEditor.insertSegmentAt(document, segIdx, position, time);
    if (!wordId) return '';

    const next = this.deriver.reapplyEffects(doc, snap.sheets, snap.video.duration, snap.decorationOverrides);
    const frozenSegments = snap.frozenSegments.withStructurallyEdited([segmentId]);

    this.store.commit();
    this.store.patch({ document: next, frozenSegments });
    return wordId;
  }

  private _roomBeside(
    document: Document,
    anchor: Segment,
    position: 'before' | 'after',
  ): TimeFragment {
    const videoDurationSec = this.videoDurationProvider();
    const limits = this.segmentBounds.limitsFor(document, anchor.id, videoDurationSec);
    return position === 'before'
      ? this._roomBefore(anchor, limits)
      : this._roomAfter(anchor, limits, videoDurationSec);
  }

  private _roomBefore(anchor: Segment, limits: WordTimeLimits): TimeFragment {
    const anchorHard = this.hardTime.of(anchor);
    const endSec = anchorHard ? anchorHard.start : anchor.time.start;
    const freeStartSec = Math.min(limits.earliestStartSec, endSec);
    return new TimeFragment(Math.max(freeStartSec, endSec - this._longestSec(anchor)), endSec);
  }

  private _roomAfter(
    anchor: Segment,
    limits: WordTimeLimits,
    videoDurationSec: number,
  ): TimeFragment {
    const anchorHard = this.hardTime.of(anchor);
    const startSec = anchorHard ? anchorHard.end : anchor.time.end;
    // An unmeasured video leaves the far limit open; the anchor's own end
    // is then the only honest place to stop.
    const openEndSec = Number.isFinite(limits.latestEndSec)
      ? limits.latestEndSec
      : Math.max(startSec, videoDurationSec);
    const freeEndSec = Math.max(openEndSec, startSec);
    return new TimeFragment(startSec, Math.min(freeEndSec, startSec + this._longestSec(anchor)));
  }

  /**
   * How long a scene inserted beside `anchor` may be. An anchor with no
   * width of its own imposes no limit, leaving the room untouched.
   */
  private _longestSec(anchor: Segment): number {
    const drawnSec = anchor.time.end - anchor.time.start;
    return drawnSec > 0 ? drawnSec : Number.POSITIVE_INFINITY;
  }
}
