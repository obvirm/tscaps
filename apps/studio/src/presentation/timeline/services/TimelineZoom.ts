/**
 * How far a row's duration may be taken. A limit of zero means the
 * panel cannot tell yet and is ignored rather than obeyed.
 */
export interface TimelineZoomLimits {
  /** Closest in: a row may not cover less than this. */
  readonly shortestSec: number;
  /** Furthest out: a row may not cover more than this. */
  readonly longestSec: number;
}

/**
 * One press of the zoom control, expressed as the row duration it lands
 * on.
 *
 * A press halves or doubles it. That is what makes a step feel like one
 * thing and makes it plainly reversible, and the range the panel spans —
 * a whole video in one row at one end, a single word at the other —
 * takes a handful of presses to cross rather than dozens.
 *
 * A press that would pass a limit lands on the limit instead of being
 * refused, so the two ends of the range are reachable exactly rather
 * than approached.
 */
export class TimelineZoom {

  constructor(private readonly stepRatio: number = 2) {}

  /** Where one press towards the words lands, or the same duration at the limit. */
  zoomedIn(rowDurationSec: number, limits: TimelineZoomLimits): number {
    return this.within(rowDurationSec / this.stepRatio, limits);
  }

  /** Where one press away from them lands, or the same duration at the limit. */
  zoomedOut(rowDurationSec: number, limits: TimelineZoomLimits): number {
    return this.within(rowDurationSec * this.stepRatio, limits);
  }

  private within(candidateSec: number, limits: TimelineZoomLimits): number {
    const withFloor = limits.shortestSec > 0
      ? Math.max(candidateSec, limits.shortestSec)
      : candidateSec;
    return limits.longestSec > 0 ? Math.min(withFloor, limits.longestSec) : withFloor;
  }
}
