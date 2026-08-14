import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementStyleSurface } from '@core/elements/domain/ElementStyleSurface';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

/** How heavy the element's text is drawn. */
export class FontWeightField implements ElementField {
  readonly id = ElementFieldId.FONT_WEIGHT;

  readonly section = ElementFieldSection.TEXT;

  controlFor(surface: ElementStyleSurface): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Weight',
      part: 'whole',
      type: 'number',
      min: 100,
      max: 900,
      step: 100,
      property: surface === 'text' ? 'font-weight' : TemplateCssVariable.FONT_WEIGHT,
    };
  }

  inheritsFromAncestor(): boolean {
    return true;
  }
}
