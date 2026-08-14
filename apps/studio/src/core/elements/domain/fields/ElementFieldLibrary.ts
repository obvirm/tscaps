import type { ElementField } from '@core/elements/domain/fields/ElementField';
import type { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';

/**
 * Every field that exists, so a kind of element can name the ones it
 * offers without building them.
 *
 * Naming an id nothing answers to throws. A kind asking for a field
 * that is not there would otherwise render one control short, and the
 * missing one is invisible — there is no gap on screen where a field
 * that was never offered would have been.
 */
export class ElementFieldLibrary {
  private readonly byId: ReadonlyMap<ElementFieldId, ElementField>;

  constructor(fields: ReadonlyArray<ElementField>) {
    this.byId = new Map(fields.map((field) => [field.id, field]));
  }

  /** The named fields, in the order they were named. */
  pick(...ids: ReadonlyArray<ElementFieldId>): ReadonlyArray<ElementField> {
    return ids.map((id) => {
      const field = this.byId.get(id);
      if (!field) throw new Error(`No element field is called "${id}".`);
      return field;
    });
  }
}
