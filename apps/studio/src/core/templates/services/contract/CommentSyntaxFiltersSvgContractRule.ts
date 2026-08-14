import type { FiltersSvgContractRule } from '@core/templates/domain/contract/FiltersSvgContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';

const COMMENT_PATTERN = /<!--([\s\S]*?)-->/g;

/**
 * Flags `--` inside an XML comment body, which XML forbids.
 *
 * It is easy to write by accident and nothing else catches it: the
 * runtime strips comments before parsing, so an invalid comment reaches
 * no parser and the template renders fine. The cost lands on whoever
 * opens the file next — every XML-aware editor reports the document as
 * malformed from that point on, and the source stops being the
 * editable artifact it is meant to be.
 *
 * Naming a custom property is the usual way in: writing
 * `var(--tscaps-outline-color)` in prose is natural and illegal.
 * Referring to the style control by id avoids it.
 */
export class CommentSyntaxFiltersSvgContractRule implements FiltersSvgContractRule {

  check(source: string): ContractViolation[] {
    const violations: ContractViolation[] = [];
    for (const comment of source.matchAll(COMMENT_PATTERN)) {
      if (!comment[1]!.includes('--')) continue;
      violations.push({
        message: 'An XML comment contains "--", which XML forbids and every XML editor reports as '
          + 'a malformed document. Name style controls by id rather than by custom property.',
      });
    }
    return violations;
  }
}
