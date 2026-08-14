import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import { ControlCssVariable } from '@core/templates/domain/definition/ControlCssVariable';
import type { StyleValues } from '@core/sheets/domain/StyleValues';
import type { AssetRepository } from '@core/assets/domain/AssetRepository';
import type { ControlValueCssRenderer } from '@core/templates/services/controls/ControlValueCssRenderer';

/**
 * Builds the `--tscaps-{id}` CSS custom-property map for a `StyleValues`
 * snapshot. Every field renders through `ControlValueCssRenderer`
 * except images, which need the asset repository to resolve a stored
 * id to a URL: an id that resolves emits `url("<resolved>")`, and one
 * that does not leaves the property unset so the template's own
 * `var(--tscaps-{id}, url('asset:<name>'))` fallback still paints.
 */
export class StyleValuesCssVarsBuilder {
  constructor(
    private readonly assetRepository: AssetRepository,
    private readonly controlValueCssRenderer: ControlValueCssRenderer,
  ) {}

  build(styleValues: StyleValues): Record<string, string> {
    const vars: Record<string, string> = {};
    for (const [field, value] of styleValues.entries()) {
      const rendered = this.renderField(field, value);
      if (rendered === null) continue;
      vars[ControlCssVariable.nameFor(field.id)] = rendered;
    }
    return vars;
  }

  private renderField(field: ControlField, value: ControlValue): string | null {
    if (field.type === 'image') return this.renderImage(value);
    return this.controlValueCssRenderer.render(field, value);
  }

  private renderImage(value: ControlValue): string | null {
    if (typeof value !== 'string') return null;
    const asset = this.assetRepository.resolve(value);
    if (asset === null) return null;
    return `url("${asset.url}")`;
  }
}
