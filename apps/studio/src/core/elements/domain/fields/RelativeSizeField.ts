import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementStyleSurface } from '@core/elements/domain/ElementStyleSurface';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';

/**
 * How big one piece of text is next to the text around it.
 *
 * A different quantity from the size a whole caption is set at, not a
 * different way of writing the same one — which is why it has its own
 * name and its own dial. What the user is after here is emphasis: this
 * bigger than its neighbours. A ratio says that and keeps saying it
 * when the caption is resized or when the template grows a short line,
 * because both of those move the neighbours too.
 *
 * A glyph riding a word takes this field rather than one of its own.
 * It is already sized this way — the baseline gives it `1em` times the
 * sheet's emoji factor — so it only ever differs in where the dial
 * starts, and that is the one thing a field does not own.
 */
export class RelativeSizeField implements ElementField {
  readonly id = ElementFieldId.RELATIVE_SIZE;

  readonly section = ElementFieldSection.LAYOUT;

  controlFor(_surface: ElementStyleSurface): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Size',
      part: 'whole',
      type: 'number',
      property: 'font-size',
      unit: '%',
      min: 10,
      max: 400,
      step: 1,
    };
  }

  /**
   * The ratio is taken against a parent that has already been given
   * whatever it was given, so the outer answer is in the rendered size
   * before this field says anything. Offering it here would put a
   * number on the dial that renders as something else the moment it is
   * committed unchanged.
   */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
