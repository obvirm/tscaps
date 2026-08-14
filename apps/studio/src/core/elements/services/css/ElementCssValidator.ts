import type { CssMinifier } from '@tscaps/engine';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementCssProblem } from '@core/elements/domain/ElementCssProblem';
import type { ElementCssRule } from '@core/elements/domain/ElementCssRule';
import type { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';

/**
 * Runs every registered rule over the CSS written against an element of
 * a given kind. Strips comments once and hands the same source to each
 * rule. An empty result means the text will do what it reads like it
 * does.
 *
 * Advisory: nothing here blocks a write. The render path repairs what it
 * has to and the user keeps their text either way, so the problems exist
 * to be shown, not to gate.
 */
export class ElementCssValidator {
  constructor(
    private readonly minifier: CssMinifier,
    private readonly timingVariableResolver: ElementTimingVariableResolver,
    private readonly rules: ReadonlyArray<ElementCssRule>,
  ) {}

  validate(css: string, kind: ElementKind): ElementCssProblem[] {
    const minified = this.minifier.minify(css);
    const context = { timingVariable: this.timingVariableResolver.resolve(kind, ElementAnimationScope.SELF) };
    return this.rules.flatMap((rule) => rule.check(minified, context));
  }
}
