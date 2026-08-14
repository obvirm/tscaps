/**
 * Cascade layers the editor emits around the CSS it assembles, ordered
 * after the engine's `CssLayer.FRAMEWORK` by appearing after it.
 *
 * The order is the whole point: what a sheet says has to beat the
 * template it started from, and what one element says has to beat both,
 * all without the user reaching for `!important`. Layers decide that by
 * order rather than specificity, so no rule has to out-weigh another.
 * The same ordering reverses for `!important`, so the framework's rules
 * stay out of reach of all three.
 */
export enum CaptionCssLayer {
  TEMPLATE = 'tscaps-template',
  SHEET = 'tscaps-sheet',
  ELEMENT = 'tscaps-element',
}
