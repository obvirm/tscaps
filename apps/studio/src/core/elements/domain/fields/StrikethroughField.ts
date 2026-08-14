import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementStyleSurface } from '@core/elements/domain/ElementStyleSurface';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

/**
 * Whether the element's text is crossed out.
 *
 * Shares its property with the underline field, so it owns the
 * `line-through` token and leaves the rest of the value alone.
 */
export class StrikethroughField implements ElementField {
  readonly id = ElementFieldId.STRIKETHROUGH;

  readonly section = ElementFieldSection.TEXT;

  controlFor(surface: ElementStyleSurface): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Strikethrough',
      part: 'keyword',
      type: 'toggle',
      options: [{ value: 'none', label: 'off' }, { value: 'line-through', label: 'on' }],
      property: surface === 'text' ? 'text-decoration-line' : TemplateCssVariable.TEXT_DECORATION,
    };
  }

  inheritsFromAncestor(): boolean {
    return true;
  }
}
