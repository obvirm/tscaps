import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';

/**
 * One animation an element was given, and what its fields hold.
 *
 * This is the record, not the CSS. The CSS is derived from it and
 * never read back: an animation is what the user picked, so asking the
 * stylesheet what was picked is asking the wrong thing — and asking it
 * of text the user can also write is asking a question with no answer.
 *
 * `presetId` is `null` for a part told not to animate at all, which
 * is a different answer from having nothing recorded: that one leaves
 * it animating however the template makes it.
 *
 * Which part of the element this moves is not held here. The same
 * motion means the same thing wherever it is given, so the part is the
 * key it is recorded under.
 */
export interface ElementAnimation {
  readonly presetId: string | null;
  /** Field values by control id. A field with no value here keeps what the animation ships. */
  readonly params: Readonly<Record<string, ElementControlValue>>;
}
