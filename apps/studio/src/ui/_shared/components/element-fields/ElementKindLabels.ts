import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementKind } from '@core/elements/domain/ElementKind';

/**
 * What each kind of element is called on screen.
 *
 * A UI answer, not a domain one: `segment` is the word the code uses
 * and "Scene" is the word the user has been reading since the timeline.
 * Kept in one place so two surfaces cannot call the same thing by two
 * names.
 */
export const ELEMENT_KIND_LABELS: Readonly<Record<ElementKind, string>> = {
  segment: 'Scene',
  line: 'Line',
  word: 'Word',
  decoration: 'Emoji',
};

/**
 * What the part an animation moves is called on screen, or `null` for
 * the one that is the element itself — that one is named by the
 * element, and only a caller holding one can say which.
 *
 * Plural against the singular of {@link ELEMENT_KIND_LABELS}, which is
 * the whole distinction on screen: `Scene` is the one being edited and
 * `Scenes` is every one of them.
 */
export const ANIMATION_SCOPE_LABELS: Readonly<Record<ElementAnimationScope, string | null>> = {
  [ElementAnimationScope.SELF]: null,
  [ElementAnimationScope.SEGMENTS]: 'Scenes',
  [ElementAnimationScope.WORDS]: 'Words',
  [ElementAnimationScope.EMOJIS]: 'Emojis',
};

/**
 * Why an animation panel is locked, for a template whose look does not
 * survive one landing there.
 *
 * Names the look as the reason rather than the mechanism: a user cannot
 * act on a stacking context, and what they can do — leave the captions
 * unanimated — is what the sentence leaves them with. Shared by the two
 * surfaces that lock, so neither can explain it differently.
 */
export const UNSUPPORTED_ANIMATION_MESSAGE =
  'This template blends its captions with the video. Animating them would cut the blend, '
  + 'so it offers no animation here.';
