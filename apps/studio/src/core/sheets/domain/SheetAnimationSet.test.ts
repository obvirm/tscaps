import { describe, expect, it } from 'vitest';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { SheetAnimationSet } from '@core/sheets/domain/SheetAnimationSet';

/**
 * What a sheet keeps about how everything under it moves, and what it
 * refuses to keep.
 *
 * A stored answer it cannot render is worse than no answer: the panel
 * would show a choice the caption does not obey, and nothing on screen
 * would say which of the two is lying.
 */

const SEGMENTS = ElementAnimationScope.SEGMENTS;
const WORDS = ElementAnimationScope.WORDS;
const SELF = ElementAnimationScope.SELF;

const RISE = { kind: 'replaced' as const, animation: { presetId: 'rise-in', params: { distance: 0.4 } }, css: '.segment { animation: rise; }' };
const FADE = { kind: 'replaced' as const, animation: { presetId: 'fade-in', params: {} }, css: '.word { animation: fade; }' };

describe('what a sheet was told', () => {
  it('survives being written down and read back', () => {
    const written = SheetAnimationSet.empty().with(SEGMENTS, RISE).with(WORDS, FADE);

    const read = SheetAnimationSet.fromSnapshot(JSON.parse(JSON.stringify(written.toSnapshot())));

    expect(read.get(SEGMENTS)).toEqual(RISE);
    expect(read.get(WORDS)).toEqual(FADE);
  });

  it('is taken back one kind at a time', () => {
    const both = SheetAnimationSet.empty().with(SEGMENTS, RISE).with(WORDS, FADE);

    const only = both.with(SEGMENTS, undefined);

    expect(only.get(SEGMENTS)).toBeNull();
    expect(only.get(WORDS)).toEqual(FADE);
  });

  it('leaves the answer it already had alone when another kind is answered', () => {
    const first = SheetAnimationSet.empty().with(SEGMENTS, RISE);

    const second = first.with(WORDS, FADE);

    expect(first.get(WORDS)).toBeNull();
    expect(second.get(SEGMENTS)?.css).toBe(RISE.css);
  });
});

describe('an answer a sheet cannot render', () => {
  it('is refused for the element itself, which a sheet is not', () => {
    const animations = SheetAnimationSet.empty().with(SELF, RISE);

    expect(animations.get(SELF)).toBeNull();
    expect(animations.isEmpty()).toBe(true);
  });

  it('is dropped on read when its record does not hold', () => {
    const read = SheetAnimationSet.fromSnapshot({ [SEGMENTS]: { animation: { presetId: 7 }, css: '.segment {}' } });

    expect(read.get(SEGMENTS)).toBeNull();
  });

  it('is dropped on read when the block it wrote never made it to text', () => {
    const read = SheetAnimationSet.fromSnapshot({ [SEGMENTS]: { animation: RISE.animation, css: '   ' } });

    expect(read.get(SEGMENTS)).toBeNull();
  });

  it('is dropped on read when it was stored for the element itself', () => {
    const read = SheetAnimationSet.fromSnapshot({ [SELF]: { animation: RISE.animation, css: '.segment {}' } });

    expect(read.isEmpty()).toBe(true);
  });

  it('is dropped on read when it names a scope this build does not offer', () => {
    const read = SheetAnimationSet.fromSnapshot({ loops: { animation: RISE.animation, css: '.segment {}' } });

    expect(read.isEmpty()).toBe(true);
  });
});

describe('the blocks a sheet renders with', () => {
  it('come out outermost kind first, whatever order they were given in', () => {
    const animations = SheetAnimationSet.empty().with(WORDS, FADE).with(SEGMENTS, RISE);

    expect(animations.css()).toBe(`${RISE.css}\n\n${FADE.css}`);
  });

  it('are nothing at all when the sheet was told nothing', () => {
    expect(SheetAnimationSet.empty().css()).toBe('');
  });
});

/**
 * The other way a kind can be answered, and the fact that a kind holds
 * one answer rather than one of each.
 *
 * Both reach the same custom properties from the same layer, so a kind
 * holding a replacement beside a tuning would need something else to
 * decide which of the two renders. There is no such thing here because
 * there is nowhere to put the second.
 */
describe('a kind answered by tuning what the template already applies', () => {
  const TUNED = { kind: 'tuned' as const, values: { '--entrance-rise': { kind: 'number' as const, amount: 0.9, unit: 'em' } }, css: '.segment { --entrance-rise: 0.9em }' };

  it('survives being written down and read back', () => {
    const written = SheetAnimationSet.empty().with(SEGMENTS, TUNED);

    const read = SheetAnimationSet.fromSnapshot(JSON.parse(JSON.stringify(written.toSnapshot())));

    expect(read.get(SEGMENTS)).toEqual(TUNED);
  });

  it('takes the place of a replacement given for the same kind', () => {
    const answered = SheetAnimationSet.empty().with(SEGMENTS, RISE).with(SEGMENTS, TUNED);

    expect(answered.get(SEGMENTS)).toEqual(TUNED);
    expect(answered.css()).toBe(TUNED.css);
  });

  it('gives its place up to a replacement given for the same kind', () => {
    const answered = SheetAnimationSet.empty().with(SEGMENTS, TUNED).with(SEGMENTS, RISE);

    expect(answered.get(SEGMENTS)).toEqual(RISE);
    expect(answered.css()).toBe(RISE.css);
  });

  it('is dropped on read when it moved no value any control could hold', () => {
    const read = SheetAnimationSet.fromSnapshot({ [SEGMENTS]: { kind: 'tuned', values: {}, css: '.segment {}' } });

    expect(read.isEmpty()).toBe(true);
  });

  it('leaves a payload written before tuning existed reading as a replacement', () => {
    const read = SheetAnimationSet.fromSnapshot({ [SEGMENTS]: { animation: RISE.animation, css: RISE.css } });

    expect(read.get(SEGMENTS)).toEqual(RISE);
  });
});
