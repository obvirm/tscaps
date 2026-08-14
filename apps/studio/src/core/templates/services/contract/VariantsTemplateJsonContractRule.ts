import type { TemplateJsonContractRule } from '@core/templates/domain/contract/TemplateJsonContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';
import type { TemplateContractContext } from '@core/templates/domain/contract/TemplateContractContext';

/**
 * Checks the `variants` array: every variant needs a label, and every
 * override key must match a style-control id the template ships — the
 * loader silently drops unknown keys, so a typo'd override does
 * nothing. Matching is against every control, whether the template
 * declared it or a primitive did, since a variant may legitimately
 * override either.
 */
export class VariantsTemplateJsonContractRule implements TemplateJsonContractRule {

  check(templateJson: unknown, context: TemplateContractContext): ContractViolation[] {
    const variants = this.variantsOf(templateJson);
    if (variants === null) return [];
    const controlIds = new Set(context.styleControlIds);
    const violations: ContractViolation[] = [];
    variants.forEach((variant, index) => {
      if (variant === null || typeof variant !== 'object' || Array.isArray(variant)) {
        violations.push({ message: `variants[${index}] must be an object.` });
        return;
      }
      this.checkVariant(variant as Record<string, unknown>, index, controlIds, violations);
    });
    return violations;
  }

  private checkVariant(
    variant: Record<string, unknown>,
    index: number,
    controlIds: ReadonlySet<string>,
    violations: ContractViolation[],
  ): void {
    const label = variant['label'];
    if (typeof label !== 'string' || label.trim() === '') {
      violations.push({ message: `variants[${index}] must declare a non-empty "label".` });
    }
    const overrides = variant['overrides'];
    if (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides)) {
      violations.push({ message: `variants[${index}] must declare an "overrides" object.` });
      return;
    }
    for (const key of Object.keys(overrides as Record<string, unknown>)) {
      if (controlIds.has(key)) continue;
      violations.push({
        message: `variants[${index}] overrides "${key}", which matches no style-control id; the loader silently ignores it.`,
      });
    }
  }

  private variantsOf(templateJson: unknown): unknown[] | null {
    if (templateJson === null || typeof templateJson !== 'object') return null;
    const variants = (templateJson as Record<string, unknown>)['variants'];
    return Array.isArray(variants) ? variants : null;
  }
}
