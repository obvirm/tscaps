/** The bounds of one row, as the resolver needs to see them. */
export interface TimelineRowBounds {
  readonly startSec: number;
  readonly endSec: number;
}

/**
 * Which rows of a timeline a stretch of time falls in.
 *
 * The two ends of a stretch answer differently, and deliberately: a
 * time landing exactly on the seam between two rows opens the row below
 * it and closes the row above it, so a stretch never claims a row it
 * holds no instant of. Every surface agreeing on where a range lives
 * asks here, because a second copy of the rule is a second chance for
 * the two to disagree.
 *
 * Rows are expected to partition the timeline in ascending order, which
 * is what both searches lean on. Answers are clamped to the timeline,
 * so a time past the end of the video resolves to the last row.
 */
export class TimelineRowIndexResolver {

  /** The first row a stretch starting at `timeSec` touches. */
  opening(timeSec: number, rows: ReadonlyArray<TimelineRowBounds>): number {
    return this.lastRowStartingBefore(timeSec, rows, true);
  }

  /** The last row a stretch ending at `timeSec` touches. */
  closing(timeSec: number, rows: ReadonlyArray<TimelineRowBounds>): number {
    return this.lastRowStartingBefore(timeSec, rows, false);
  }

  private lastRowStartingBefore(
    timeSec: number,
    rows: ReadonlyArray<TimelineRowBounds>,
    includeExactStart: boolean,
  ): number {
    let low = 0;
    let high = rows.length - 1;
    let found = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const startSec = rows[middle]!.startSec;
      const reached = includeExactStart ? startSec <= timeSec : startSec < timeSec;
      if (reached) {
        found = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return Math.max(0, Math.min(rows.length - 1, found));
  }
}
