import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';

/**
 * What a set of controls was left at, read back out of storage.
 *
 * A control holds a number or a string and nothing else, so anything
 * else in the payload is dropped rather than carried into a panel that
 * would then have to describe it. Whatever a dropped entry was, the
 * control falls back to what it ships with, which renders.
 *
 * The same reading serves an element's fields and an animation's
 * parameters: both are values by control id, and the day one of them
 * accepts something the other does not, they stop being one rule.
 */
export class StoredElementControlValues {

  /** The values that hold, or nothing when none of them did. */
  static read(value: unknown): Readonly<Record<string, ElementControlValue>> | undefined {
    if (value === null || typeof value !== 'object') return undefined;
    const values: Record<string, ElementControlValue> = {};
    for (const [id, held] of Object.entries(value)) {
      if (typeof held === 'number' || typeof held === 'string') values[id] = held;
    }
    return Object.keys(values).length > 0 ? values : undefined;
  }
}
