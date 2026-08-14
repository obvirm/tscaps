/** What the reader can see of the stack of rows right now. */
export interface TimelineViewport {
  readonly offsetPx: number;
  readonly heightPx: number;
}

/**
 * Where the stack has to be scrolled for the row the playhead is in to
 * be where the reader is looking, or null when it already is.
 *
 * The row has one resting place on the screen and stays in it: when the
 * playhead moves on, the panel advances by that row's height and the
 * next row arrives in the same spot. **What has to stay still is the
 * reader's eye, not the text** — a row that lands somewhere new costs
 * them their place, however few scrolls it saves.
 *
 * That place is one row up from the bottom edge, so the row is whole,
 * clear of the edge, and has what comes next drawn under it.
 *
 * Every position is in the **scroller's** coordinates — the ones a
 * scroll offset is expressed in — never in the list's. The two differ
 * by whatever is drawn above the list, and a row placed as if they were
 * the same lands that much too low.
 */
export class TimelineFollowScroll {

  offsetFor(rowTopPx: number, rowHeightPx: number, viewport: TimelineViewport): number | null {
    if (viewport.heightPx <= 0) return null;
    const restingPx = this.restingOffsetFor(rowTopPx, rowHeightPx, viewport);
    if (viewport.offsetPx < restingPx) return restingPx;
    if (this.isPast(rowTopPx, rowHeightPx, viewport)) return restingPx;
    return null;
  }

  /**
   * Whether the row has gone off the top, which is what a jump backwards
   * leaves behind. A row merely clipped at its top edge has not: that is
   * the reader having nudged the panel, and taking those few pixels back
   * from them would leave it unscrollable while the video plays.
   */
  private isPast(rowTopPx: number, rowHeightPx: number, viewport: TimelineViewport): boolean {
    return rowTopPx + rowHeightPx <= viewport.offsetPx;
  }

  /** Where the panel sits while the row is in its place. */
  private restingOffsetFor(
    rowTopPx: number,
    rowHeightPx: number,
    viewport: TimelineViewport,
  ): number {
    const bottomOfViewPx = rowTopPx + rowHeightPx + this.lookAheadPx(rowHeightPx, viewport);
    return Math.max(0, bottomOfViewPx - viewport.heightPx);
  }

  /**
   * How much of what comes next is kept below the row: one row, and none
   * at all when the panel has no room to spare for both.
   */
  private lookAheadPx(rowHeightPx: number, viewport: TimelineViewport): number {
    return viewport.heightPx >= rowHeightPx * 2 ? rowHeightPx : 0;
  }
}
