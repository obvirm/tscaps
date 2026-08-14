import type { TimelineRowGeometry } from '@presentation/timeline/services/TimelineRowGeometryResolver';
import type { TimelineRow, TimelineSceneRun } from '@presentation/timeline/services/TimelineProjection';

/**
 * Which scene a pointer is inside, given where it sits over a row.
 *
 * Answered from the row's own model rather than from what the pointer
 * happens to be over: a scene is drawn behind the words and silences it
 * holds, so the topmost element under the pointer is almost never the
 * scene itself, and hovering a word would otherwise read as leaving the
 * scene that word belongs to.
 *
 * A channel holds at most one scene at any instant, so there is exactly
 * one answer and nothing to rank. That is a property of channels, not a
 * coincidence: sheets that claim the same instant are read in channels
 * of their own, and two segments of one sheet are kept from sharing one.
 */
export class TimelineScenePointerResolver {

  /**
   * The scene under the pointer, or `null` where none runs. The whole
   * run and not merely its id, because acting on it needs to know the
   * group it belongs to.
   *
   * `xFraction` is the position across the row in `[0, 1]` and
   * `offsetYPx` is measured from the top of the row's interaction zone,
   * so anything outside the channel — the ruler above it, the waveform
   * strip below — answers null.
   */
  resolve(
    row: TimelineRow,
    geometry: TimelineRowGeometry,
    xFraction: number,
    offsetYPx: number,
  ): TimelineSceneRun | null {
    if (!this.isOverChannel(offsetYPx, geometry)) return null;
    const timeSec = row.startSec + xFraction * (row.endSec - row.startSec);
    return row.sceneRuns.find((run) => timeSec >= run.startSec && timeSec < run.endSec) ?? null;
  }

  private isOverChannel(offsetYPx: number, geometry: TimelineRowGeometry): boolean {
    const withinChannelPx = offsetYPx - geometry.channelTopPx;
    return withinChannelPx >= 0 && withinChannelPx < geometry.channelHeightPx;
  }
}
