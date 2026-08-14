import type { ElementCssContext } from '@core/elements/domain/ElementCssContext';
import type { ElementCssProblem } from '@core/elements/domain/ElementCssProblem';

/**
 * One check over the CSS written against an element. Receives
 * comment-free source and reports every problem it finds; an empty
 * result means the source passes this rule.
 *
 * Checks are lexical and must never throw: the source is whatever the
 * user has typed so far, and half a rule is the normal case.
 */
export interface ElementCssRule {
  check(minifiedCss: string, context: ElementCssContext): ElementCssProblem[];
}
