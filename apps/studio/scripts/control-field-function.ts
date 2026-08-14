import { SassBoolean, SassColor, SassNumber, SassString, type Value } from 'sass';
import { FontStackResolver } from '@core/fonts/services/FontStackResolver';
import type { ControlValue } from '@core/templates/domain/definition/ControlField';
import { ControlCssVariable } from '@core/templates/domain/definition/ControlCssVariable';
import { ControlValueCssRenderer } from '@core/templates/services/controls/ControlValueCssRenderer';
import type { TemplateStyleControlRegistry } from '@core/templates/services/controls/TemplateStyleControlRegistry';

const controlValueCssRenderer = new ControlValueCssRenderer(new FontStackResolver());

/**
 * Reads the default a stylesheet passed to `control.field(...)`. Sass
 * hands numbers, colours and booleans as its own value types.
 *
 * Numbers must be unitless: the unit belongs to the control's concept,
 * so a stylesheet writing one would either repeat the catalog or
 * contradict it, and a contradiction would be silently overwritten.
 */
function toControlValue(id: string, value: Value): ControlValue {
  if (value instanceof SassColor) return value.toString();
  if (value instanceof SassBoolean) return value.value;
  if (value instanceof SassNumber) {
    if (!value.hasUnits) return value.value;
    throw new Error(
      `Style control "${id}" was given the default ${value.toString()}, which carries a unit. `
      + `Pass the number alone — the unit comes from the control.`,
    );
  }
  return value.assertString().text;
}

/**
 * The `tscaps-control-field($id, $default)` implementation behind
 * `_lib/control.scss`. Declaring and reading are one call so a
 * primitive cannot read a control without also giving its caller the
 * control to drive it.
 */
export function controlFieldFunction(registry: TemplateStyleControlRegistry) {
  return (args: Value[]): Value => {
    const id = args[0]!.assertString().text;
    const field = registry.declare(id, toControlValue(id, args[1]!));
    const fallback = controlValueCssRenderer.render(field, field.default);
    return new SassString(`var(${ControlCssVariable.nameFor(id)}, ${fallback})`, { quotes: false });
  };
}
