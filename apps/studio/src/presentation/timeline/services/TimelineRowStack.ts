/**
 * Where the stack of rows sits inside the element that scrolls it.
 *
 * Rows are counted from zero while a scroll offset is counted from the
 * top of the scrolling element, and the two differ by whatever is drawn
 * above the stack. Everything that places a row by scroll offset asks
 * here, because a second copy of that sum is a second chance for the two
 * to disagree — and a row placed on the wrong one lands that much too
 * low, under the bottom edge of the panel.
 */
export class TimelineRowStack {

  /**
   * @param topPx where the first row starts inside the scrolling element
   * @param heightPx what each row reserves, rows all being the same height
   */
  constructor(
    readonly topPx: number,
    readonly heightPx: number,
  ) {}

  /** Where a row's top sits inside the scrolling element. */
  topPxOf(rowIndex: number): number {
    return this.topPx + rowIndex * this.heightPx;
  }
}
