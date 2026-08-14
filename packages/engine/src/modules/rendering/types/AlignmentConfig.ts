import type { HorizontalSide } from '@modules/bidi/HorizontalSide';

export type VerticalAlign = 'top' | 'center' | 'bottom';

/** Every vertical anchor, for reading one back off something that was stored. */
export const VERTICAL_ALIGNS: ReadonlyArray<VerticalAlign> = ['top', 'center', 'bottom'];
export type HorizontalAlign = HorizontalSide;

/**
 * Symmetric box-anchor positioning. `*Offset` is the absolute position of
 * the anchor point as a fraction of the video's dimensions; `*Align`
 * decides which edge of the caption box lands on that point:
 *   top/left/start   → 0% of own size
 *   center           → 50%
 *   bottom/right/end → 100%
 *
 * E.g. `verticalOffset: 1, verticalAlign: 'bottom'` pins the box's bottom
 * edge to the video's bottom edge. `horizontalOffset: 0.5,
 * horizontalAlign: 'center'` centers the box horizontally.
 *
 * `horizontalAlign` decides how the whole horizontal axis is read: with a
 * screen side, `horizontalOffset` counts from the video's left edge; with a
 * reading side, it counts from the edge where reading begins. The two are
 * never mixed, so `start` at `0.06` sits six percent in from the left in
 * left-to-right text and six percent in from the right in right-to-left
 * text, while `left` at `0.06` stays put in both. `center` is treated as a
 * screen side: it names the same place either way, and leaving its offset
 * alone keeps a caption the reader positioned by hand where they put it.
 */
export interface AlignmentConfig {
  verticalAlign: VerticalAlign;
  // Fraction of video height [0, 1].
  verticalOffset: number;
  horizontalAlign: HorizontalAlign;
  // Fraction of video width [0, 1].
  horizontalOffset: number;
}
