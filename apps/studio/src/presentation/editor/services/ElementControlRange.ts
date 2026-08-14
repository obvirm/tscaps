import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';

/**
 * Keeps a value a handle is dragging inside the range its own field
 * declares.
 *
 * The bounds are the field's, not this class's: a handle that could
 * push past the slider beside it would land on a value the slider
 * refuses, and the panel would then snap the number the moment the
 * user touched it. A field with no bound on a side is unbounded on
 * that side.
 */
export class ElementControlRange {
  clamp(control: AuthoredElementControl, value: number): number {
    const min = control.min ?? Number.NEGATIVE_INFINITY;
    const max = control.max ?? Number.POSITIVE_INFINITY;
    return Math.min(max, Math.max(min, value));
  }
}
