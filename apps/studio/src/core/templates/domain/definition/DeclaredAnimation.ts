import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import type { CaptionNodeKind } from '@core/elements/domain/CaptionNodeKind';

/**
 * A library animation a template applies, the kind of element it was
 * applied to, and the value it gives each of the animation's
 * properties.
 *
 * `element` is what the template said, not a reading of the selector
 * it wrote. It is what decides where a value tuned over this animation
 * has to be declared for the animation to read it, and which answer
 * takes the animation over when one replaces it.
 *
 * `values` is keyed by the custom property each one is given to, and
 * carries what the stylesheet wrote rather than a reading of what it
 * compiled to. A property the template answers two ways is absent:
 * two answers is not a value a dial could start on.
 *
 * `keyframes` names the `@keyframes` blocks the animation is made of,
 * usually one. It is what makes an animation applied without being
 * declared findable: the compiled stylesheet's `animation` references
 * are checked against these, so the omission is a build error rather
 * than a panel later reading it as no animation at all.
 */
export interface DeclaredAnimation {
  readonly id: string;
  readonly element: CaptionNodeKind;
  readonly values: Readonly<Record<string, AnimationValue>>;
  readonly keyframes: readonly string[];
}
