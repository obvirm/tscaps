import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementStyleSurface } from '@core/elements/domain/ElementStyleSurface';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

/** How far the element is turned around its own centre. */
export class RotationField implements ElementField {
  readonly id = ElementFieldId.ROTATION;

  readonly section = ElementFieldSection.LAYOUT;

  controlFor(surface: ElementStyleSurface): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Rotation',
      part: 'whole',
      type: 'number',
      unit: 'deg',
      min: -180,
      max: 180,
      step: 1,
      property: surface === 'text' ? 'rotate' : TemplateCssVariable.ROTATION,
    };
  }

  /**
   * A turn composes with the turn around it rather than replacing it,
   * so what an ancestor was given is already in where this element
   * points. Showing that angle here would double it the moment the
   * dial is nudged.
   */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
