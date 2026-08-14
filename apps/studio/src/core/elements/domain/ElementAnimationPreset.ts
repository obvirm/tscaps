import type { ElementControl } from '@core/elements/domain/ElementControl';

/**
 * One entrance an element can be given, as the CSS that expresses it.
 *
 * Compiled from the animation library, so an entrance picked here and
 * the same entrance used by a template are the same motion rather than
 * two copies that drift.
 *
 * Applying an entrance writes these declarations and this block into
 * the element's own CSS, where they stay readable and editable.
 */
export interface ElementAnimationPreset {
  readonly id: string;
  /** The `@keyframes` name its animation references, which is how the entrance is recognised in CSS later. */
  readonly keyframeName: string;
  /** The custom properties its declarations set, so replacing an entrance can take the previous one's out. */
  readonly customProperties: ReadonlyArray<string>;
  /** The `@keyframes` block, which is the same whichever clock the element anchors to. */
  readonly keyframes: string;
  /** The declarations, keyed by the clock variable their animation is delayed by. */
  readonly declarationsByTimingVariable: Readonly<Record<string, string>>;
  /** The fields the editor offers for it, in the order they are shown. */
  readonly controls: ReadonlyArray<ElementControl>;
  /** The picture a picker draws it as: one `<svg>`, monochrome through `currentColor`. */
  readonly icon: string;
}
