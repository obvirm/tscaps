import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';

/**
 * An immutable set of time ranges over one video, kept sorted and
 * non-overlapping. Every operation returns a new set.
 *
 * Ranges arrive from callers in whatever order and shape they have —
 * one per caption, one per detected scene — so the set normalises on
 * the way in: sorted by start, and touching or overlapping ranges
 * fused into one. Everything downstream can then assume a walk in
 * time order visits each instant once.
 */
export class TimeRangeSet {
  private constructor(private readonly ranges: ReadonlyArray<PersonSegmentationWindow>) {}

  static readonly EMPTY = new TimeRangeSet([]);

  /** Normalises `ranges`: empty and inverted ones are dropped, the rest sorted and fused. */
  static of(ranges: ReadonlyArray<PersonSegmentationWindow>): TimeRangeSet {
    const usable = ranges.filter((range) => range.end > range.start);
    if (usable.length === 0) return TimeRangeSet.EMPTY;
    const sorted = [...usable].sort((a, b) => a.start - b.start);
    const fused: PersonSegmentationWindow[] = [];
    let open = sorted[0]!;
    for (const range of sorted.slice(1)) {
      if (range.start <= open.end) {
        open = { start: open.start, end: Math.max(open.end, range.end) };
        continue;
      }
      fused.push(open);
      open = range;
    }
    fused.push(open);
    return new TimeRangeSet(fused);
  }

  /** Grows every range by `seconds` on both sides, never below zero, and re-fuses what now touches. */
  paddedBy(seconds: number): TimeRangeSet {
    return TimeRangeSet.of(this.ranges.map((range) => ({
      start: Math.max(0, range.start - seconds),
      end: range.end + seconds,
    })));
  }

  /** The instants held by both sets. */
  intersectedWith(other: TimeRangeSet): TimeRangeSet {
    const overlaps: PersonSegmentationWindow[] = [];
    for (const mine of this.ranges) {
      for (const theirs of other.ranges) {
        const start = Math.max(mine.start, theirs.start);
        const end = Math.min(mine.end, theirs.end);
        if (end > start) overlaps.push({ start, end });
      }
    }
    return TimeRangeSet.of(overlaps);
  }

  /**
   * The instants this set holds and `other` does not. A range `other`
   * covers in the middle is left as the two pieces around it.
   */
  minus(other: TimeRangeSet): TimeRangeSet {
    const remaining: PersonSegmentationWindow[] = [];
    for (const mine of this.ranges) {
      remaining.push(...this.punchedOut(mine, other));
    }
    return TimeRangeSet.of(remaining);
  }

  private punchedOut(
    range: PersonSegmentationWindow,
    other: TimeRangeSet,
  ): ReadonlyArray<PersonSegmentationWindow> {
    let pieces: PersonSegmentationWindow[] = [range];
    for (const hole of other.ranges) {
      const survivors: PersonSegmentationWindow[] = [];
      for (const piece of pieces) {
        if (hole.end <= piece.start || hole.start >= piece.end) {
          survivors.push(piece);
          continue;
        }
        if (hole.start > piece.start) survivors.push({ start: piece.start, end: hole.start });
        if (hole.end < piece.end) survivors.push({ start: hole.end, end: piece.end });
      }
      pieces = survivors;
    }
    return pieces;
  }

  /** Clamps every range to `[0, seconds]`, dropping what falls entirely outside. */
  clampedTo(seconds: number): TimeRangeSet {
    return this.intersectedWith(TimeRangeSet.of([{ start: 0, end: seconds }]));
  }

  /** Whether `seconds` falls inside one of the ranges. */
  containsInstant(seconds: number): boolean {
    return this.ranges.some((range) => range.start <= seconds && seconds <= range.end);
  }

  list(): ReadonlyArray<PersonSegmentationWindow> {
    return this.ranges;
  }

  isEmpty(): boolean {
    return this.ranges.length === 0;
  }

  totalSeconds(): number {
    return this.ranges.reduce((total, range) => total + (range.end - range.start), 0);
  }
}
