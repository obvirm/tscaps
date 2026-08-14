import { describe, expect, it } from 'vitest';
import { CssScoper } from '@modules/css/CssScoper';
import { FROZEN_FRAME_CSS } from '@modules/rendering/styles/FrozenFrameCss';

describe('FROZEN_FRAME_CSS', () => {
  it('forces both halves of the contract, so an `animation:` shorthand cannot reset them', () => {
    expect(FROZEN_FRAME_CSS).toContain('animation-play-state: paused !important');
    expect(FROZEN_FRAME_CSS).toContain('animation-fill-mode: both !important');
  });

  it('reaches elements and pseudo-elements alike once scoped into a shared document', () => {
    const scoped = new CssScoper().scope(FROZEN_FRAME_CSS, '.host');

    expect(scoped).toContain('.host *');
    expect(scoped).toContain('.host *::before');
    expect(scoped).toContain('.host *::after');
    // A selector left unprefixed would freeze every animation on the page.
    expect(scoped).not.toMatch(/(^|,)\s*\*/);
  });
});
