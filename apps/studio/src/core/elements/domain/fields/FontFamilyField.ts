import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementStyleSurface } from '@core/elements/domain/ElementStyleSurface';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

/** The typeface the element's text is set in. */
export class FontFamilyField implements ElementField {
  readonly id = ElementFieldId.FONT_FAMILY;

  readonly section = ElementFieldSection.TEXT;

  controlFor(surface: ElementStyleSurface): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Font',
      part: 'whole',
      type: 'font',
      property: surface === 'text' ? 'font-family' : TemplateCssVariable.FONT_FAMILY,
    };
  }

  inheritsFromAncestor(): boolean {
    return true;
  }
}
