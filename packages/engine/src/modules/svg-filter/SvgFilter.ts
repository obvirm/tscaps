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
  private readonly referencedVariables: ReadonlySet<string>;

  constructor(
    readonly id: string,
    readonly attributes: ReadonlyMap<string, string>,
    private readonly source: string,
  ) {
    this.referencedVariables = SvgFilter.scanVariableNames(source);
  }

  /**
   * Custom property names the body reads, so a caller can describe the
   * scope this filter is sensitive to without materializing it. Read
   * with the same pattern `materialize` substitutes on, which is what
   * keeps the two answers about the same set of names.
   */
  get variableNames(): ReadonlySet<string> {
    return this.referencedVariables;
  }

  materialize(scope: SvgFilterScope): string {
    return this.source.replace(VAR_REF_RE, (match, name, fallback) => {
      const value = scope.resolve(name);
      if (value !== undefined) return value;
      if (fallback !== undefined) return fallback;
      return match;
    });
  }

  private static scanVariableNames(source: string): ReadonlySet<string> {
    const names = new Set<string>();
    for (const reference of source.matchAll(VAR_REF_RE)) names.add(reference[1]!);
    return names;
  }
}
