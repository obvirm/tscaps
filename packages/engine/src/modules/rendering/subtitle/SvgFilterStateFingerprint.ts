import type { SvgFilterBundle } from '@modules/svg-filter/SvgFilterBundle';
import type { SvgFilterDefinitions } from '@modules/svg-filter/SvgFilterDefinitions';
import type { SvgFilterDefsRenderer } from '@modules/svg-filter/SvgFilterDefsRenderer';
import type { SvgFilterLengthFactors } from '@modules/svg-filter/SvgFilterScopeProvider';
import type { SvgFilterScope } from '@modules/svg-filter/SvgFilterScope';

const COMPARISON_SCOPE_KEY = 'fingerprint';
const UNRESOLVED_REFERENCE = 'var(';

/** The last answer given for one style, and the inputs it was given for. */
interface LastAnswer {
  readonly inputs: string;
  readonly markup: string | null;
}

/**
 * Describes the filter markup a style paints at one timestamp, so two
 * timestamps can be told apart before either of them is rendered.
 *
 * The description is that markup itself, produced by the same renderer
 * the tile uses under a fixed id scope. Everything reaching the browser
 * is therefore in the comparison by construction, including whatever a
 * later change adds to it — a description assembled out of the inputs
 * separately would go stale the day the renderer grew one more.
 *
 * Two answers are not markup:
 *
 * - `''` — the style declares no filters, so none of its pixels come
 *   from one.
 * - `null` — the markup cannot be compared. A `var()` the scope left
 *   unresolved survives into the body and the document's CSS decides
 *   what it becomes, which is not visible from here; engine-injected
 *   variables are not layered in either, so a filter reading one lands
 *   in this case too. The caller must treat it as varying every frame.
 *
 * Rendering the markup costs far more than asking for it, and
 * consecutive timestamps almost always resolve to the same one, so the
 * answer given to a style is kept until that style's inputs change. The
 * inputs are the values the scope resolves for the names these bodies
 * read plus the length factors, which is what the markup is a function
 * of — a filter reading a per-frame tick therefore misses every time,
 * and pays exactly what it would have without the cache.
 */
export class SvgFilterStateFingerprint {
  private readonly lastAnswerByStyle = new Map<string, LastAnswer>();

  constructor(
    private readonly defsRenderer: SvgFilterDefsRenderer,
    private readonly renderHeightPx: number,
  ) {}

  at(styleKind: string, filters: SvgFilterBundle, t: number): string | null {
    if (filters.definitions.isEmpty()) return '';
    const context = { currentTime: t, renderHeightPx: this.renderHeightPx };
    const scope = filters.scopeProvider.scopeAt(context);
    const lengthFactors = filters.scopeProvider.lengthFactorsAt(context);
    const inputs = this.describeInputs(filters.definitions, scope, lengthFactors);

    const last = this.lastAnswerByStyle.get(styleKind);
    if (last && last.inputs === inputs) return last.markup;

    const markup = this.render(filters.definitions, scope, lengthFactors);
    this.lastAnswerByStyle.set(styleKind, { inputs, markup });
    return markup;
  }

  private render(
    definitions: SvgFilterDefinitions,
    scope: SvgFilterScope,
    lengthFactors: SvgFilterLengthFactors,
  ): string | null {
    const { defs } = this.defsRenderer.render(definitions, scope, lengthFactors, COMPARISON_SCOPE_KEY);
    return defs.includes(UNRESOLVED_REFERENCE) ? null : defs;
  }

  /**
   * The values the markup is built from, in a form where two different
   * sets of them cannot read as the same text. Encoded rather than
   * joined: a scope holds whatever a style control was given, so no
   * separator can be assumed absent from it, and `null` says a name is
   * unresolved without colliding with a name resolved to nothing.
   */
  private describeInputs(
    definitions: SvgFilterDefinitions,
    scope: SvgFilterScope,
    lengthFactors: SvgFilterLengthFactors,
  ): string {
    const values = definitions.variableNames().map((name) => scope.resolve(name) ?? null);
    return JSON.stringify([lengthFactors.pxPerEm, lengthFactors.pxPerCqh, values]);
  }
}
