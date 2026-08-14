import { describe, expect, it } from 'vitest';
import { HorizontalSideResolver } from '@modules/bidi/HorizontalSideResolver';
import { HorizontalPlacementResolver } from '@modules/rendering/HorizontalPlacementResolver';

const resolver = new HorizontalPlacementResolver(new HorizontalSideResolver());

describe('HorizontalPlacementResolver', () => {

  it('leaves a screen anchor where the author put it', () => {
    expect(resolver.resolve('left', 0.06, 'ltr')).toEqual({ side: 'left', offsetFromLeft: 0.06 });
    expect(resolver.resolve('left', 0.06, 'rtl')).toEqual({ side: 'left', offsetFromLeft: 0.06 });
    expect(resolver.resolve('right', 0.94, 'rtl')).toEqual({ side: 'right', offsetFromLeft: 0.94 });
  });

  // Both halves travel together: an anchor mirrored on its own would pin the
  // box's far edge to the near side of the frame and throw it off screen.
  it('mirrors a reading anchor together with its offset', () => {
    expect(resolver.resolve('start', 0.06, 'ltr')).toEqual({ side: 'left', offsetFromLeft: 0.06 });
    const mirrored = resolver.resolve('start', 0.06, 'rtl');
    expect(mirrored.side).toBe('right');
    expect(mirrored.offsetFromLeft).toBeCloseTo(0.94);
  });

  it('reads the centre as a screen anchor, so its offset is left alone', () => {
    expect(resolver.resolve('center', 0.3, 'rtl')).toEqual({ side: 'center', offsetFromLeft: 0.3 });
  });
});
