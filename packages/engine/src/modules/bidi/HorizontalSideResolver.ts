import type { HorizontalSide, PhysicalSide } from '@modules/bidi/HorizontalSide';
import type { TextDirection } from '@modules/bidi/TextDirection';

/**
 * Resolves a horizontal side to the side of the screen it lands on under a
 * given paragraph direction. A side already named in screen terms passes
 * through, which is what lets a layout value accept either vocabulary.
 *
 * Values are resolved here rather than handed to CSS as `start` / `end`
 * because CSS resolves its own flow-relative keywords against the element's
 * `direction`, which the renderer pins so that words already placed in
 * painting order are not placed again.
 */
export class HorizontalSideResolver {
  toPhysical(side: HorizontalSide, textDirection: TextDirection): PhysicalSide {
    if (side === 'start') return textDirection === 'ltr' ? 'left' : 'right';
    if (side === 'end') return textDirection === 'ltr' ? 'right' : 'left';
    return side;
  }

  /**
   * Restates a fraction measured from the reading start as one measured from
   * the left edge, and back — the conversion is its own inverse.
   */
  mirrorOffset(offset: number, textDirection: TextDirection): number {
    return textDirection === 'ltr' ? offset : 1 - offset;
  }
}
