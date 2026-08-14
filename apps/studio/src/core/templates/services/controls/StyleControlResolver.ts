import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type { StyleControlCatalog } from '@core/templates/domain/definition/StyleControlCatalog';
import type { JsonStyleControlEntry } from '@core/templates/domain/definition/JsonTemplateSchema';

/**
 * Turns a `template.json` entry into a full `ControlField`.
 *
 * When the id lives in the catalog, the concept's metadata (type,
 * unit, group, bounds) comes from there and the template supplies the
 * default plus optionally a contextual `label` / `legend` that names
 * what the concept is doing in this template — everything else is
 * concept-owned. When the id is not catalogued, the entry must
 * already be a full field and passes through unchanged.
 */
export class StyleControlResolver {
  constructor(private readonly catalog: StyleControlCatalog) {}

  resolve(entry: JsonStyleControlEntry): ControlField {
    if (!this.catalog.has(entry.id)) return entry as ControlField;
    const catalogued = this.catalog.fieldFor(entry.id, entry.default as ControlValue);
    return { ...catalogued, ...this.templateOverridesOf(entry) };
  }

  private templateOverridesOf(entry: JsonStyleControlEntry): Partial<ControlField> {
    return {
      ...(entry.label !== undefined ? { label: entry.label } : {}),
      ...(entry.legend !== undefined ? { legend: entry.legend } : {}),
      ...(entry.cloudOnly !== undefined ? { cloudOnly: entry.cloudOnly } : {}),
    };
  }
}
