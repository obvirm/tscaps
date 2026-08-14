/**
 * Which addressable elements render under a sheet.
 *
 * Asked here and answered elsewhere: which captions a sheet owns is the
 * other side of this module's boundary, and an answer that has to stop
 * being answered further in needs nothing but the ids — what kind each
 * one is is already recorded against it.
 */
export interface SheetElementResolver {
  /**
   * Every element the sheet paints, however deep. Empty for a sheet
   * nothing on screen answers to.
   */
  elementsOf(sheetId: string): ReadonlySet<string>;
}
