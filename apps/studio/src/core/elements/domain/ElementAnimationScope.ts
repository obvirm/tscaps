import type { ElementKind } from '@core/elements/domain/ElementKind';

/**
 * What an animation moves.
 *
 * An element can be told how it enters and, separately, how the parts
 * inside it enter — one after another, each on its own clock. Doing
 * that part by part is the same choice repeated, and it stops being the
 * caption's answer the moment a word or a glyph is added. A sheet
 * answers the same questions for everything rendering under it, which
 * is why the scopes that name a kind carry no mention of an element.
 *
 * Not a property of the animation: the same entrance means the same
 * motion whichever scope it is given to. It decides which element wears
 * the declarations and which clock they anchor to, and nothing else.
 */
export enum ElementAnimationScope {
  /** The element itself. Meaningless without one, so a sheet never offers it. */
  SELF = 'self',
  /** Every caption. */
  SEGMENTS = 'segments',
  /** Every word. */
  WORDS = 'words',
  /** Every glyph attached to a word. */
  EMOJIS = 'emojis',
}

export const ELEMENT_ANIMATION_SCOPES: ReadonlyArray<ElementAnimationScope> = [
  ElementAnimationScope.SELF,
  ElementAnimationScope.SEGMENTS,
  ElementAnimationScope.WORDS,
  ElementAnimationScope.EMOJIS,
];

/**
 * The scopes a sheet can answer: every one that names a kind of its
 * own. A sheet is not a rendered element, so `self` would have nothing
 * to land on.
 */
export const SHEET_ANIMATION_SCOPES: ReadonlyArray<ElementAnimationScope> = [
  ElementAnimationScope.SEGMENTS,
  ElementAnimationScope.WORDS,
  ElementAnimationScope.EMOJIS,
];

/**
 * The kind of element a scope animates inside the one it was given to,
 * or `null` for the element itself.
 *
 * One answer, three uses: it names the selector the declarations are
 * wrapped in, the clock they anchor to, and what an answer given here
 * reaches. Derived from one place so a scope cannot end up writing a
 * selector for one kind and a clock for another.
 */
export const ANIMATED_KIND_BY_SCOPE: Readonly<Record<ElementAnimationScope, ElementKind | null>> = {
  [ElementAnimationScope.SELF]: null,
  [ElementAnimationScope.SEGMENTS]: 'segment',
  [ElementAnimationScope.WORDS]: 'word',
  [ElementAnimationScope.EMOJIS]: 'decoration',
};
