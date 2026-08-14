import type { PhysicalSide, ReadingSide } from '@modules/bidi/HorizontalSide';
import type { HorizontalSideResolver } from '@modules/bidi/HorizontalSideResolver';
import type { TextDirection } from '@modules/bidi/TextDirection';
import type { HorizontalAlign } from '@modules/rendering/types/AlignmentConfig';

/** Where a caption box's horizontal anchor lands, stated in screen terms. */
export interface HorizontalPlacement {
  readonly side: PhysicalSide;
  /** Fraction of the video's width, counted from its left edge. */
  readonly offsetFromLeft: number;
}

/**
 * Resolves the horizontal half of an `AlignmentConfig` into the screen terms
 * a renderer paints with.
 *
 * The anchor decides how its own offset is read: a screen side leaves the
 * offset counting from the left edge, a reading side flips both together so
 * the placement mirrors with the direction of the text. Keeping the pair
 * consistent is the whole contract — an anchor mirrored without its offset
 * lands the box on the far side of the frame.
 */
export class HorizontalPlacementResolver {

  constructor(private readonly horizontalSideResolver: HorizontalSideResolver) {}

  resolve(
    horizontalAlign: HorizontalAlign,
    horizontalOffset: number,
    textDirection: TextDirection,
  ): HorizontalPlacement {
    if (!this.isReadingSide(horizontalAlign)) {
      return { side: horizontalAlign, offsetFromLeft: horizontalOffset };
    }
    return {
      side: this.horizontalSideResolver.toPhysical(horizontalAlign, textDirection),
      offsetFromLeft: this.horizontalSideResolver.mirrorOffset(horizontalOffset, textDirection),
    };
  }

  // `center` belongs to both vocabularies and is deliberately not treated as
  // a reading side: its own offset is then left in screen terms.
  private isReadingSide(horizontalAlign: HorizontalAlign): horizontalAlign is ReadingSide {
    return horizontalAlign === 'start' || horizontalAlign === 'end';
  }
}
