/**
 * Which cell the pointer is over, for cells the timeline had to draw in
 * more than one piece. Subscribers listen for `'change'`.
 *
 * A word or a silence longer than a row is cut at the row's edge and
 * drawn again in the next one. Nothing about two chips a row apart says
 * they are the same thing, so pointing at either lights up both. It is
 * kept apart from the selection state on purpose: hovering happens
 * constantly, and everything watching a selection would be woken by it
 * for nothing.
 */
export class TimelineCellHoverController extends EventTarget {

  private _hoveredCellId: string | null = null;

  get hoveredCellId(): string | null {
    return this._hoveredCellId;
  }

  hover(cellId: string): void {
    if (this._hoveredCellId === cellId) return;
    this._hoveredCellId = cellId;
    this.notify();
  }

  /**
   * Drops the hover, ignoring the call when some other cell has already
   * taken it. Leaving one piece and arriving at another fires in that
   * order, so an unguarded clear would blank a hover that just moved to
   * a sibling piece.
   */
  clear(cellId: string): void {
    if (this._hoveredCellId !== cellId) return;
    this._hoveredCellId = null;
    this.notify();
  }

  private notify(): void {
    this.dispatchEvent(new Event('change'));
  }
}
