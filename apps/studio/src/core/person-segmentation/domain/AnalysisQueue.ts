import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';

/**
 * The stretches of video still waiting to be analysed, handed out
 * nearest-first to wherever the viewer is looking.
 *
 * There is no fixed order and nothing to re-prioritise: the order is
 * recomputed from the focus point every time a chunk is taken, so a
 * seek reorders the whole queue by moving the focus. Work already done
 * is subtracted rather than skipped, so a chunk never spans a stretch
 * that has been measured already.
 */
export class AnalysisQueue {
  private pending = TimeRangeSet.EMPTY;

  /** Adds `ranges` to what is waiting. Stretches already waiting are not duplicated. */
  request(ranges: TimeRangeSet): void {
    this.pending = TimeRangeSet.of([...this.pending.list(), ...ranges.list()]);
  }

  /** Drops `ranges` from what is waiting, whether they were analysed or abandoned. */
  settle(ranges: TimeRangeSet): void {
    this.pending = this.pending.minus(ranges);
  }

  /** Drops everything waiting, for when the video underneath the queue is no longer the one being edited. */
  clear(): void {
    this.pending = TimeRangeSet.EMPTY;
  }

  /** Everything still waiting. */
  remaining(): TimeRangeSet {
    return this.pending;
  }

  isEmpty(): boolean {
    return this.pending.isEmpty();
  }

  /**
   * The next `chunkSeconds` of waiting work, taken around the point of
   * `focusSeconds`, or everything waiting when less than that is left.
   *
   * The measure is work, not elapsed video: a stretch inside the reach
   * that has already been measured costs nothing and the chunk reaches
   * further to make up for it, so every chunk is worth the same amount
   * of detector time however fragmented the queue has become. It
   * reaches both ways from the focus, so a viewer who jumps somewhere
   * can then move either way from it. Empty when nothing is waiting.
   */
  nextChunkNear(focusSeconds: number, chunkSeconds: number): TimeRangeSet {
    if (this.pending.isEmpty()) return TimeRangeSet.EMPTY;
    const centre = this.centreFor(focusSeconds, chunkSeconds);
    return this.reachAround(centre, this.reachHolding(centre, chunkSeconds));
  }

  /**
   * Where the chunk is centred: the viewer themselves while there is
   * anything waiting within half a chunk of them — including when they
   * sit in a measured hole, where the work on both sides is what they
   * are about to reach — and the near edge of the nearest waiting
   * stretch otherwise.
   */
  private centreFor(focusSeconds: number, chunkSeconds: number): number {
    if (!this.reachAround(focusSeconds, chunkSeconds / 2).isEmpty()) return focusSeconds;
    const nearest = this.rangeNearest(focusSeconds);
    if (nearest === null) return focusSeconds;
    return Math.min(Math.max(focusSeconds, nearest.start), nearest.end);
  }

  /**
   * The reach around `centreSeconds` that holds exactly `wantedSeconds`
   * of waiting work, or the reach that holds all of it when less is
   * left.
   *
   * Solved rather than searched: how much work a reach holds grows
   * piecewise-linearly with the reach, bending only where the reach
   * crosses the edge of a waiting stretch, so walking those edges
   * outward and interpolating across the last one lands on the answer.
   */
  private reachHolding(centreSeconds: number, wantedSeconds: number): number {
    let previousReach = 0;
    let previousHeld = 0;
    for (const reach of this.reachesAtWhichHeldWorkBends(centreSeconds)) {
      const held = this.reachAround(centreSeconds, reach).totalSeconds();
      if (held >= wantedSeconds) {
        const growthPerSecondOfReach = (held - previousHeld) / (reach - previousReach);
        return previousReach + (wantedSeconds - previousHeld) / growthPerSecondOfReach;
      }
      previousReach = reach;
      previousHeld = held;
    }
    return previousReach;
  }

  /** The distances from `centreSeconds` to the waiting stretches' edges, nearest first. */
  private reachesAtWhichHeldWorkBends(centreSeconds: number): number[] {
    const distances = new Set<number>();
    for (const range of this.pending.list()) {
      distances.add(Math.abs(range.start - centreSeconds));
      distances.add(Math.abs(range.end - centreSeconds));
    }
    return [...distances].filter((distance) => distance > 0).sort((a, b) => a - b);
  }

  private reachAround(centreSeconds: number, reachSeconds: number): TimeRangeSet {
    return TimeRangeSet
      .of([{ start: centreSeconds - reachSeconds, end: centreSeconds + reachSeconds }])
      .intersectedWith(this.pending);
  }

  private rangeNearest(focusSeconds: number): PersonSegmentationWindow | null {
    let nearest: PersonSegmentationWindow | null = null;
    let shortestGap = Infinity;
    for (const range of this.pending.list()) {
      const gap = this.gapTo(range, focusSeconds);
      if (gap >= shortestGap) continue;
      shortestGap = gap;
      nearest = range;
    }
    return nearest;
  }

  private gapTo(range: PersonSegmentationWindow, focusSeconds: number): number {
    if (focusSeconds < range.start) return range.start - focusSeconds;
    if (focusSeconds > range.end) return focusSeconds - range.end;
    return 0;
  }
}
