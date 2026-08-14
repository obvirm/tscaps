import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementStyleSurface } from '@core/elements/domain/ElementStyleSurface';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

/** Whether the element's text is slanted. */
export class ItalicField implements ElementField {
  readonly id = ElementFieldId.ITALIC;

  readonly section = ElementFieldSection.TEXT;

  controlFor(surface: ElementStyleSurface): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Italic',
      part: 'whole',
      type: 'toggle',
      options: [{ value: 'normal', label: 'off' }, { value: 'italic', label: 'on' }],
      property: surface === 'text' ? 'font-style' : TemplateCssVariable.FONT_STYLE,
    };
  }

  inheritsFromAncestor(): boolean {
    return true;
  }
}
