import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';

/**
 * The value a field holds, taken from the value the stylesheet gave the
 * property it drives.
 *
 * A `sign` and a `magnitude` field share one property between them, so
 * each takes its own half: the direction is the sign, the distance is
 * the absolute value. Arithmetic, because the value arrives as an
 * amount and a unit rather than as the text it prints as.
 *
 * A field over something with no number under it — a duration a
 * template routes through a variable of its own — holds nothing. That
 * is the field being out of reach, not an error: the animation runs,
 * and only the dial over it cannot open.
 */
export class ElementControlValueParser {

  /** `null` when the value is not one this field could hold. */
  parse(control: AuthoredElementControl, value: AnimationValue): ElementControlValue | null {
    if (control.part === 'whole' && control.type !== 'number') {
      return value.kind === 'text' ? value.text : `${value.amount}${value.unit}`;
    }
    if (value.kind !== 'number') return null;
    if (control.part === 'sign') return value.amount < 0 ? 'negative' : 'positive';
    return control.part === 'magnitude' ? Math.abs(value.amount) : value.amount;
  }
}
