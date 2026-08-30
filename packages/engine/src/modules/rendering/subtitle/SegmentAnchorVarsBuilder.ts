import { CssVariable } from '@modules/document/CssVariable';
import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';

/**
 * Where a subtree's anchor sits, in the terms a stylesheet needs to
 * reason about it.
 */
export interface AnchorPlacement {
  /** Anchor position down the frame, as a fraction of its height. */
  readonly verticalOffset: number;
  /** Share of the box's own height that sits above the anchor: 0, 50 or 100. */
  readonly vAnchorPct: number;
}

/**
 * Publishes a subtree's vertical anchor so a stylesheet can address the
 * frame rather than the anchor it happens to hang from.
 *
 * Positioning is resolved before any stylesheet runs, which leaves CSS
 * able to move a caption only *relative* to wherever it was placed. A
 * rule wanting an absolute position therefore has to undo the placement
 * first, and these two values are what that costs: the offset says where
 * the anchor landed, and the origin says which part of the box was put
 * on it. Emitted as a percentage, the origin resolves against the box's
 * own height inside a `translate`, so a rule can convert any anchor to a
 * top-edge one without knowing how tall the caption grew.
 */
export class SegmentAnchorVarsBuilder {

  build(placement: AnchorPlacement): InlineStyleMap {
    return {
      [CssVariable.SEGMENT_ANCHOR_Y]: String(placement.verticalOffset),
      [CssVariable.SEGMENT_ANCHOR_ORIGIN_Y]: `${placement.vAnchorPct}%`,
    };
  }
}
