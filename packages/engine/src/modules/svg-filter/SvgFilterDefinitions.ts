import type { SvgFilter } from '@modules/svg-filter/SvgFilter';

/**
 * Immutable list of `<filter>` declarations that a stylesheet may
 * reference via `filter: url(#id)`. Each entry carries the filter's
 * local id (the value inside `url(#…)`) and an XML body whose
 * `var(--name)` placeholders get resolved at render time.
 */
export class SvgFilterDefinitions {
  private sortedVariableNames: ReadonlyArray<string> | null = null;

  static empty(): SvgFilterDefinitions {
    return new SvgFilterDefinitions([]);
  }

  constructor(private readonly _filters: ReadonlyArray<SvgFilter>) {}

  /**
   * Every custom property name these bodies read, sorted, so two
   * scopes can be compared over the names that matter to this set and
   * in a stable order. Computed on first use and kept.
   */
  variableNames(): ReadonlyArray<string> {
    if (this.sortedVariableNames === null) {
      const names = new Set<string>();
      for (const filter of this._filters) {
        for (const name of filter.variableNames) names.add(name);
      }
      this.sortedVariableNames = [...names].sort();
    }
    return this.sortedVariableNames;
  }

  get filters(): ReadonlyArray<SvgFilter> {
    return this._filters;
  }

  get ids(): ReadonlySet<string> {
    return new Set(this._filters.map((f) => f.id));
  }

  isEmpty(): boolean {
    return this._filters.length === 0;
  }
}
