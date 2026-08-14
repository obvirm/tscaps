import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementStyleSurface } from '@core/elements/domain/ElementStyleSurface';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

/**
 * How big the text inside a wrapper is, as a share of the frame.
 *
 * The same quantity the sheet sets for the whole caption, which is why
 * it keeps that name and that unit: it writes the variable the sheet
 * writes, and the one variable cannot mean a share of the frame coming
 * from the sheet and something else coming from a segment.
 *
 * The text inside is sized against this rather than against the frame
 * → {@link RelativeSizeField}.
 */
export class FontSizeField implements ElementField {
  readonly id = ElementFieldId.FONT_SIZE;

  readonly section = ElementFieldSection.LAYOUT;

  controlFor(_surface: ElementStyleSurface): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Size',
      part: 'whole',
      type: 'number',
      property: TemplateCssVariable.FONT_SIZE,
      unit: 'cqh',
      min: 1,
      max: 25,
      step: 0.1,
    };
  }

  inheritsFromAncestor(): boolean {
    return true;
  }
}
