import type { CssContractRule } from '@core/templates/domain/contract/CssContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';

const IMPORTANT_PATTERN = /!\s*important/gi;

/**
 * Flags `!important` in a template's CSS.
 *
 * Cascade order reverses for `!important`: the earlier layer wins, and
 * the template's layer comes before the per-element one. So a single
 * `!important` here is not a strong rule, it is an unreachable one —
 * nothing the editor can produce for a single word, scene or emoji gets
 * past it. Not a fragment, not a fragment that writes `!important`
 * itself, and not the structured overrides behind the colour picker and
 * the size slider, which land as inline declarations without it.
 *
 * The failure is silent and looks like a broken editor rather than a
 * stylesheet decision, which is what makes it worth naming at the point
 * it is written.
 */
export class ImportantDeclarationsCssContractRule implements CssContractRule {

  check(minifiedCss: string): ContractViolation[] {
    const occurrences = [...minifiedCss.matchAll(IMPORTANT_PATTERN)].length;
    if (occurrences === 0) return [];
    return [{
      message: `${this.subject(occurrences)} marked "!important". Nothing styled per element can override that. `
        + 'Cascade layers reverse for "!important", so the Properties panel, the colour picker and the '
        + 'size slider all lose to these rules, silently. Raise the selector instead.',
    }];
  }

  private subject(occurrences: number): string {
    return occurrences === 1 ? 'One declaration is' : `${occurrences} declarations are`;
  }
}
