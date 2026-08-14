import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';

/**
 * The value a property takes once one of the fields over it moves.
 *
 * The other direction of {@link ElementControlValueParser}. It matters
 * because a `sign` and a `magnitude` field share one property: moving
 * the distance has to leave the direction where it was, and picking a
 * direction has to leave the distance alone. Each field writes its own
 * half onto the value already there.
 */
export class AnimationValueComposer {

  /** `standing` is what the property holds now, which the moved field only partly replaces. */
  compose(standing: AnimationValue, control: AuthoredElementControl, moved: ElementControlValue): AnimationValue {
    if (control.part === 'sign') return this.signed(standing, moved === 'negative');
    if (typeof moved !== 'number') return { kind: 'text', text: String(moved) };
    const unit = control.unit ?? (standing.kind === 'number' ? standing.unit : '');
    if (control.part === 'magnitude') {
      const negative = standing.kind === 'number' && standing.amount < 0;
      return { kind: 'number', amount: negative ? -Math.abs(moved) : Math.abs(moved), unit };
    }
    return { kind: 'number', amount: moved, unit };
  }

  private signed(standing: AnimationValue, negative: boolean): AnimationValue {
    if (standing.kind !== 'number') return standing;
    const amount = Math.abs(standing.amount);
    return { kind: 'number', amount: negative ? -amount : amount, unit: standing.unit };
  }
}
