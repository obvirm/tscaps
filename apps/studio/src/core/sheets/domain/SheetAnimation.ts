import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import type { AnimationValue } from '@core/elements/domain/AnimationValue';

/**
 * What a set of tuned controls holds, by the custom property each
 * value writes.
 *
 * Keyed by the property rather than by the control that drove it,
 * because an element ends up with one value per property however many
 * controls point at it: two animations on one kind both offering a
 * duration are one dial, not two that would fight.
 */
export type TunedPropertyValues = Readonly<Record<string, AnimationValue>>;

/** An animation the sheet put in place of the template's, and what it compiled to. */
export interface ReplacedAnimation {
  readonly kind: 'replaced';
  readonly animation: ElementAnimation;
  readonly css: string;
}

/** Values the sheet moved inside the animation the template already applies, and what they compiled to. */
export interface TunedAnimation {
  readonly kind: 'tuned';
  readonly values: TunedPropertyValues;
  readonly css: string;
}

/**
 * How a sheet answered for one kind of element: by putting a different
 * animation in place of the template's, or by moving values inside the
 * one already there.
 *
 * One answer, never both. They reach the same custom properties from
 * the same layer, so a kind holding two of these would have no way to
 * say which is live — the union is what makes that unrepresentable
 * rather than something the assembly has to be careful about.
 *
 * Both carry the text they compiled to, so a later change to the
 * animation library reaches new answers and no saved project.
 */
export type SheetAnimation = ReplacedAnimation | TunedAnimation;
