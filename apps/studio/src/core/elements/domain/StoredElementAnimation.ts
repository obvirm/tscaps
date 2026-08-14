import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import { StoredElementControlValues } from '@core/elements/domain/StoredElementControlValues';

/**
 * One animation read back out of storage.
 *
 * Nothing here checks that the animation still exists in the library:
 * a project saved against a catalogue that has since dropped an
 * entrance keeps the record, and what it renders as is decided where
 * the CSS is built. Dropping it on read would take a name the user
 * chose away over a library change they never made.
 *
 * What does not hold is dropped — a payload that is not an object, or
 * one whose `presetId` is neither a name nor the null that means "told
 * not to move". That part then animates however the template makes it.
 */
export class StoredElementAnimation {

  /** The animation the payload describes, or nothing when it describes none. */
  static read(value: unknown): ElementAnimation | undefined {
    if (value === null || typeof value !== 'object') return undefined;
    const { presetId, params } = value as Partial<ElementAnimation>;
    if (presetId !== null && typeof presetId !== 'string') return undefined;
    return { presetId, params: StoredElementControlValues.read(params) ?? {} };
  }
}
