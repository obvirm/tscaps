import type { SvgFilterScope } from '@modules/svg-filter/SvgFilterScope';

const VAR_REF_RE = /var\(\s*(--[a-zA-Z_][a-zA-Z0-9_-]*)\s*(?:,\s*([^)]*?))?\s*\)/g;

/**
 * One `<filter>` declaration that a stylesheet references via
 * `filter: url(#id)`. The body XML carries `var(--name, fallback)`
 * placeholders that `materialize` resolves against a render-time
 * scope; unresolved references are left in place so attributes that
 * are CSS properties (e.g. `flood-color`) can still resolve via the
 * host document's CSS variable inheritance after the filter mounts.
 *
 * `attributes` holds everything the element declared except its id,
 * which is reassigned per render scope. They are not decoration: the
 * filter region (`x` / `y` / `width` / `height`) decides how far
 * beyond its element a filter may paint, so a blur whose region is
 * dropped ends in a straight cut instead of fading out.
 */
export class SvgFilter {
  constructor(
    readonly id: string,
    readonly attributes: ReadonlyMap<string, string>,
    private readonly source: string,
  ) {}

  materialize(scope: SvgFilterScope): string {
    return this.source.replace(VAR_REF_RE, (match, name, fallback) => {
      const value = scope.resolve(name);
      if (value !== undefined) return value;
      if (fallback !== undefined) return fallback;
      return match;
    });
  }
}
