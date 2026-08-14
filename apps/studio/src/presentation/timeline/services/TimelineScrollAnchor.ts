/** What decides where a time falls in the list of rows. */
export interface TimelineRowLayout {
  /** Seconds one row covers. Zero until the panel and the transcript are both real. */
  readonly durationSec: number;
  /** What a row reserves in the list, rows all being the same height. Positive. */
  readonly heightPx: number;
}

/**
 * Holds the reader's place in the **video** across a change to how the
 * rows are drawn, so they end up looking at the same words afterwards
 * rather than at the same scroll offset.
 *
 * Two things move that place, and either one alone is enough: the
 * seconds a row covers, which a zoom changes, and the height a row
 * reserves, which anything turned on or off above or below the words
 * changes. Both appear in the sum that turns an offset into a time, so
 * the place is kept only while **neither** has moved — an anchor
 * refreshed against a layout the offset was not measured under records a
 * time the reader was never at.
 *
 * The place is the time at the **top** of the viewport, which is what a
 * document does when its type size changes. It is exact rather than
 * approximate because rows are all the same computed height, so an
 * offset and a time convert into each other with no measuring.
 */
export class TimelineScrollAnchor {

  private layout: TimelineRowLayout | null = null;
  private timeSec = 0;

  /**
   * Records where the reader is, from an offset read while `layout` was
   * the one on screen. Does nothing once the layout has moved under
   * them, which is what leaves the last place they were really at intact
   * for {@link restore} to put back.
   */
  track(offsetPx: number, layout: TimelineRowLayout): void {
    if (this.layout && this.hasMoved(layout)) return;
    this.layout = layout;
    this.timeSec = (offsetPx / layout.heightPx) * layout.durationSec;
  }

  /**
   * The offset that puts the reader back where they were, or null when
   * nothing moved under them and they are already there.
   *
   * Answering once per change is deliberate: a second call under the
   * same layout returns null, so a repeated pass cannot fight the reader
   * for the scrollbar.
   */
  restore(layout: TimelineRowLayout): number | null {
    if (!this.hasMoved(layout)) return null;
    this.layout = layout;
    return this.offsetIn(layout);
  }

  private offsetIn(layout: TimelineRowLayout): number | null {
    if (layout.durationSec <= 0) return null;
    return (this.timeSec / layout.durationSec) * layout.heightPx;
  }

  private hasMoved(layout: TimelineRowLayout): boolean {
    return this.layout?.durationSec !== layout.durationSec
      || this.layout.heightPx !== layout.heightPx;
  }
}
