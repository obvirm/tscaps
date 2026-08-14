import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';
import { SvgFilterScope } from '@modules/svg-filter/SvgFilterScope';
import type { SvgFilterDefs, SvgFilterDefsRenderer } from '@modules/svg-filter/SvgFilterDefsRenderer';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';

const EMPTY_DEFS: SvgFilterDefs = { defs: '', bindings: new Map() };

/**
 * Materializes the SVG `<filter>` defs declared by a style's filter
 * bundle for one render tile. Layers the engine-injected vars onto the
 * consumer's scope and hands the result to the defs renderer under an
 * id scope unique to the tile, so two tiles using the same source
 * filter don't collide in the sprite-sheet SVG.
 *
 * Returns empty defs and empty bindings when the style declares no
 * filters.
 */
export class SvgFilterMaterializer {

  constructor(
    private readonly defsRenderer: SvgFilterDefsRenderer,
    private readonly renderHeightPx: number,
  ) {}

  materialize(
    style: PreparedStyle,
    t: number,
    engineVars: InlineStyleMap,
    nextUid: () => number,
  ): SvgFilterDefs {
    const definitions = style.filters.definitions;
    if (definitions.isEmpty()) return EMPTY_DEFS;
    const context = { currentTime: t, renderHeightPx: this.renderHeightPx };
    const consumerScope = style.filters.scopeProvider.scopeAt(context);
    const scope = consumerScope.with(SvgFilterScope.fromEntries(Object.entries(engineVars)));
    return this.defsRenderer.render(
      definitions,
      scope,
      style.filters.scopeProvider.lengthFactorsAt(context),
      `${style.scopeClass}-${nextUid()}`,
    );
  }
}
