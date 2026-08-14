import type { SvgFilter } from '@modules/svg-filter/SvgFilter';
import type { SvgFilterDefinitions } from '@modules/svg-filter/SvgFilterDefinitions';
import type { SvgFilterScope } from '@modules/svg-filter/SvgFilterScope';
import type { SvgFilterScoper } from '@modules/svg-filter/SvgFilterScoper';
import type { SvgFilterLengthResolver } from '@modules/svg-filter/SvgFilterLengthResolver';
import type { SvgFilterLengthFactors } from '@modules/svg-filter/SvgFilterScopeProvider';

/**
 * Output of `SvgFilterDefsRenderer.render`. `defs` is the `<filter>`
 * markup to splice into an SVG document; `bindings` maps each CSS
 * variable a consuming element must carry to the `url(#scopedId)` that
 * reaches the filter it was rendered under. Neither is usable without
 * the other: markup nothing references paints nothing, and a reference
 * to markup that was never spliced in resolves to no filter.
 */
export interface SvgFilterDefs {
  readonly defs: string;
  readonly bindings: ReadonlyMap<string, string>;
}

/**
 * Renders filter definitions into the SVG markup one render context
 * needs: every body materialized against that context's variable
 * scope, its `em` / `cqh` lengths resolved to px, and its element
 * re-emitted under an id unique to `scopeKey` so independent filter
 * sets can share a document.
 *
 * Every attribute the author declared travels with the element. The
 * filter region (`x` / `y` / `width` / `height`) bounds how far past
 * its element a filter may paint, and `color-interpolation-filters`
 * picks the colour space its primitives blend in, so an element
 * re-emitted without them renders something the author did not ask
 * for — a blur cut off mid-fade, seams blended in the wrong space.
 *
 * `scopeKey` must be unique among filter sets coexisting in the same
 * SVG document.
 */
export class SvgFilterDefsRenderer {
  constructor(
    private readonly scoper: SvgFilterScoper,
    private readonly lengthResolver: SvgFilterLengthResolver,
  ) {}

  render(
    definitions: SvgFilterDefinitions,
    scope: SvgFilterScope,
    lengthFactors: SvgFilterLengthFactors,
    scopeKey: string,
  ): SvgFilterDefs {
    const { idByLocal, bindings } = this.scoper.scopeIds(definitions.ids, scopeKey);
    const defs = definitions.filters
      .map((filter) => this.renderFilter(filter, scope, lengthFactors, idByLocal.get(filter.id)!))
      .join('');
    return { defs, bindings };
  }

  private renderFilter(
    filter: SvgFilter,
    scope: SvgFilterScope,
    lengthFactors: SvgFilterLengthFactors,
    scopedId: string,
  ): string {
    const body = this.lengthResolver.resolve(filter.materialize(scope), lengthFactors);
    return `<filter ${this.attributeMarkup(filter, scopedId)}>${body}</filter>`;
  }

  private attributeMarkup(filter: SvgFilter, scopedId: string): string {
    const declarations = [`id="${this.escape(scopedId)}"`];
    for (const [name, value] of filter.attributes) {
      declarations.push(`${name}="${this.escape(value)}"`);
    }
    return declarations.join(' ');
  }

  private escape(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }
}
