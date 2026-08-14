import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type { FontStackResolver } from '@core/fonts/services/FontStackResolver';

/**
 * Turns a style-control value into the CSS token its custom property
 * carries, following the field's type:
 *
 * - `toggle` picks `valueOn` / `valueOff`, so CSS reads the property
 *   directly (`font-style: var(--tscaps-italic)`).
 * - `select` emits the matched option's `cssValue`, falling back to the
 *   stored value when the option is gone.
 * - `text` emits a CSS `<string>` token, quoted and escaped, safe to
 *   substitute into `content: var(...)`.
 * - `font` emits the family's full stack, so the line's metrics and
 *   its glyphs come from the same face.
 * - a number with a declared unit emits `${value}${unit}`.
 *
 * `image` is not handled here: resolving an asset id to a URL needs a
 * repository, which makes it a different responsibility.
 */
export class ControlValueCssRenderer {
  constructor(private readonly fontStackResolver: FontStackResolver) {}

  render(field: ControlField, value: ControlValue): string {
    if (field.type === 'toggle') {
      return value ? (field.valueOn ?? '1') : (field.valueOff ?? '0');
    }
    if (field.type === 'select') {
      const match = field.options?.find((option) => option.value === value);
      return match?.cssValue ?? String(value);
    }
    if (field.type === 'text') {
      return this.asCssString(String(value));
    }
    if (field.type === 'font') {
      return this.fontStackResolver.resolve(String(value));
    }
    if (typeof value === 'number' && field.unit) {
      return `${value}${field.unit}`;
    }
    return String(value);
  }

  private asCssString(value: string): string {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
}
