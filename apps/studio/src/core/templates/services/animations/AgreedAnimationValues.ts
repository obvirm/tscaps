import type { AnimationValue } from '@core/elements/domain/AnimationValue';

/**
 * The values every call site of one animation agreed on.
 *
 * A template may apply the same animation more than once, and the
 * places it applies it are not obliged to say the same thing. milo
 * slides its first line in from the left and its last from the right
 * through one property; a single dial over that would flatten the
 * design the moment it moved. So a property answered two ways is
 * dropped rather than resolved by whichever call came last.
 *
 * Answered the same way twice is one answer, not a dispute.
 */
export class AgreedAnimationValues {
  /** `null` marks a property the call sites disagreed on, which is not the same as one nobody set. */
  private readonly byProperty = new Map<string, AnimationValue | null>();

  add(values: ReadonlyMap<string, AnimationValue>): void {
    for (const [property, value] of values) {
      const held = this.byProperty.get(property);
      if (held === undefined) this.byProperty.set(property, value);
      else if (held !== null && !this.same(held, value)) this.byProperty.set(property, null);
    }
  }

  agreed(): Readonly<Record<string, AnimationValue>> {
    const agreed: Record<string, AnimationValue> = {};
    for (const [property, value] of this.byProperty) {
      if (value !== null) agreed[property] = value;
    }
    return agreed;
  }

  private same(left: AnimationValue, right: AnimationValue): boolean {
    if (left.kind === 'number' && right.kind === 'number') {
      return left.amount === right.amount && left.unit === right.unit;
    }
    return left.kind === 'text' && right.kind === 'text' && left.text === right.text;
  }
}
