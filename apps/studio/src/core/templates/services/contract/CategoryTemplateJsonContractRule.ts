import type { TemplateJsonContractRule } from '@core/templates/domain/contract/TemplateJsonContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';
import { TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_NAMES } from '@core/templates/domain/TemplateCategory';

/**
 * Checks that a template names a family the gallery ships. The failure
 * it exists for is silent: an unrecognised name loads as the default
 * family, so a typo puts the template in a section nobody chose for it
 * and everything else keeps working.
 */
export class CategoryTemplateJsonContractRule implements TemplateJsonContractRule {

  check(templateJson: unknown): ContractViolation[] {
    const declared = this.categoryOf(templateJson);
    if (declared === undefined) {
      return [{
        message: 'Declares no "category". Name one of: ' + TEMPLATE_CATEGORY_NAMES.join(', ') + '.',
      }];
    }
    if (declared in TEMPLATE_CATEGORIES) return [];
    return [{
      message: `Declares the unknown category "${declared}". Name one of: `
        + TEMPLATE_CATEGORY_NAMES.join(', ') + '.',
    }];
  }

  private categoryOf(templateJson: unknown): string | undefined {
    if (templateJson === null || typeof templateJson !== 'object') return undefined;
    const category = (templateJson as Record<string, unknown>)['category'];
    return typeof category === 'string' ? category : undefined;
  }
}
