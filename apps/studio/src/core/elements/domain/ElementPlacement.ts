import type { PhysicalSide, VerticalAlign } from '@tscaps/engine';

/**
 * Where an element was put in the video frame, once the user took it
 * out of the flow it was laid out in.
 *
 * All four parts are required, and that is the point. An offset is only
 * a place while the anchor it was read against holds still: storing one
 * alone and inheriting the anchor made the same number name a different
 * place the moment the sheet's alignment moved, which is a position
 * nobody edited changing on its own. Present means placed, absent means
 * still in the flow, and there is no half of one.
 *
 * The anchor is not offered to the user — they put a box somewhere,
 * they do not choose box-anchor semantics. It is captured from wherever
 * the element already sat. Horizontally it is always a screen side, so
 * a later change to the sheet's reading direction cannot mirror
 * something that was placed by hand.
 */
export interface ElementPlacement {
  /** Edge of the element's box that `verticalOffset` places. */
  readonly verticalAlign: VerticalAlign;
  /** Fraction of video height [0, 1]. */
  readonly verticalOffset: number;
  /** Edge of the element's box that `horizontalOffset` places, in screen terms. */
  readonly horizontalAlign: PhysicalSide;
  /** Fraction of video width [0, 1], counted from the left edge. */
  readonly horizontalOffset: number;
}
