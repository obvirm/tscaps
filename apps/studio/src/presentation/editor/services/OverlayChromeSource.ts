/** Where a piece of chrome sits and how big it is, in scaler-relative CSS pixels. */
export interface ChromeGeometry {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** CSS `transform` the chrome adopts. Absent for chrome whose own rotation is written elsewhere. */
  readonly transform?: string;
}

/**
 * One piece of overlay chrome, as the thing that repositions it sees it:
 * where its nodes are, how it measures itself, and how it writes what it
 * measured.
 *
 * Measuring and writing are separate on purpose. Reading layout after a
 * write forces the browser to lay the page out again, so every piece
 * measures before any piece writes and one layout serves them all.
 * A `measure` that writes, or an `apply` that reads, puts that cost back
 * once per piece.
 */
export interface OverlayChromeSource {
  /** The chrome box itself, or null while it is not mounted. */
  box(): HTMLElement | null;
  /** The overlay scaler the chrome is measured against, or null while it is not mounted. */
  scaler(): HTMLElement | null;
  /** The painted element the chrome frames, or null while it is absent from the DOM. */
  target(): HTMLElement | null;
  /** Reads the geometry the chrome should adopt. Must not write to the DOM. */
  measure(target: HTMLElement, scaler: HTMLElement): ChromeGeometry;
  /** Writes a geometry `measure` returned. Must not read layout. */
  apply(box: HTMLElement, geometry: ChromeGeometry): void;
}
