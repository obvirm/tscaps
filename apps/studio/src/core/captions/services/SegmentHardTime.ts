import { TimeFragment, type Segment } from '@tscaps/engine';

/**
 * The window a segment defends: the part of the clock that is its own,
 * and that a neighbour may not be dragged into.
 *
 * Two things make it up, and both are things somebody decided:
 *
 * - its **words**, which is when it is actually narrated;
 * - its **`customTime`**, the window a caller named outright.
 *
 * `effectTime` is deliberately left out. Gap-free padding is derived —
 * recomputed after every edit — so a neighbour growing into it simply
 * makes it shrink, and nothing is lost. Treating it as a wall would
 * stop a drag against a boundary nobody chose and nothing keeps.
 *
 * Empty words count. They sit in the line like any other and their
 * times are as real as the rest.
 */
export class SegmentHardTime {

  /** `null` for a segment with neither words nor a named window. */
  of(segment: Segment): TimeFragment | null {
    const words = segment.getWords();
    const first = words[0];
    const last = words[words.length - 1];
    if (!first || !last) return segment.customTime;
    const custom = segment.customTime;
    return new TimeFragment(
      Math.min(first.time.start, custom ? custom.start : first.time.start),
      Math.max(last.time.end, custom ? custom.end : last.time.end),
    );
  }
}
