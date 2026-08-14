import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type { StyleControlCatalog } from '@core/templates/domain/definition/StyleControlCatalog';

/**
 * Collects the style controls one template declares while its
 * stylesheet is compiled. A CSS primitive that reads a control
 * variable declares it here, so the control reaches the template
 * without the template having to know the primitive needed one.
 *
 * Declaring the same id twice is normal — a template may apply the
 * same primitive to two elements — and is collapsed as long as both
 * ask for the same default. Two different defaults for one control
 * have no correct resolution, so they are reported rather than
 * silently resolved by declaration order.
 *
 * One instance covers one template: it accumulates and never resets.
 */
export class TemplateStyleControlRegistry {
  private readonly fieldsById = new Map<string, ControlField>();

  constructor(private readonly catalog: StyleControlCatalog) {}

  /** Returns the declared control, whose default is what a `var()` reference falls back to. */
  declare(id: string, defaultValue: ControlValue): ControlField {
    const field = this.catalog.fieldFor(id, defaultValue);
    const existing = this.fieldsById.get(id);
    if (existing !== undefined && existing.default !== defaultValue) {
      throw new Error(
        `Style control "${id}" is declared twice with different defaults `
        + `(${String(existing.default)} and ${String(defaultValue)}). `
        + `A control has one default per template.`,
      );
    }
    this.fieldsById.set(id, field);
    return field;
  }

  declared(): readonly ControlField[] {
    return [...this.fieldsById.values()];
  }
}
