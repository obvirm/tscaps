import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementStyleSurface } from '@core/elements/domain/ElementStyleSurface';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

/**
 * Whether the element's text is underlined.
 *
 * A `keyword` field rather than a plain switch, because the property
 * carries underline and strikethrough at once and CSS offers no
 * longhand for either alone. This one owns the `underline` token and
 * leaves whatever else is in there untouched.
 */
export class UnderlineField implements ElementField {
  readonly id = ElementFieldId.UNDERLINE;

  readonly section = ElementFieldSection.TEXT;

  controlFor(surface: ElementStyleSurface): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Underline',
      part: 'keyword',
      type: 'toggle',
      options: [{ value: 'none', label: 'off' }, { value: 'underline', label: 'on' }],
      property: surface === 'text' ? 'text-decoration-line' : TemplateCssVariable.TEXT_DECORATION,
    };
  }

  inheritsFromAncestor(): boolean {
    return true;
  }
}
