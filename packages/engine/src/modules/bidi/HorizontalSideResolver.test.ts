import { describe, expect, it } from 'vitest';
import { HorizontalSideResolver } from '@modules/bidi/HorizontalSideResolver';

const resolver = new HorizontalSideResolver();

describe('HorizontalSideResolver', () => {

  it('lands a reading side on the screen side it reads from', () => {
    expect(resolver.toPhysical('start', 'ltr')).toBe('left');
    expect(resolver.toPhysical('end', 'ltr')).toBe('right');
    expect(resolver.toPhysical('start', 'rtl')).toBe('right');
    expect(resolver.toPhysical('end', 'rtl')).toBe('left');
  });

  it('leaves the centre alone in both directions', () => {
    expect(resolver.toPhysical('center', 'rtl')).toBe('center');
    expect(resolver.mirrorOffset(0.5, 'rtl')).toBe(0.5);
  });

  it('measures an offset from the edge reading begins at', () => {
    expect(resolver.mirrorOffset(0.06, 'ltr')).toBe(0.06);
    expect(resolver.mirrorOffset(0.06, 'rtl')).toBeCloseTo(0.94);
  });

  // Reading and screen terms are the same statement said two ways, so an
  // offset taken through the mirror twice has to come back unchanged.
  it('round-trips an offset', () => {
    for (const direction of ['ltr', 'rtl'] as const) {
      expect(resolver.mirrorOffset(resolver.mirrorOffset(0.23, direction), direction)).toBeCloseTo(0.23);
    }
  });
});
