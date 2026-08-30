/**
 * Resolves the rendered pixel width of a span of text. Implementations
 * decide how (DOM probe, Canvas 2D, lookup table, WASM, etc.); pixel-width
 * line splitters consume only this contract and stay agnostic to the
 * measurement strategy. Consumers can plug in their own implementation
 * when they have richer typography information than the default probe
 * can recover from CSS alone.
 */
export interface TextMeasurer {
  /**
   * Width of `text` rendered as a single inline run, in px.
   *
   * `cssClasses` are the classes the run will carry beyond the word's own,
   * which is what a stylesheet sizing some words differently keys off. Pass
   * them or a word a template grows is measured at the size of one it
   * leaves alone.
   */
  measure(text: string, cssClasses: ReadonlyArray<string>): number;
}
