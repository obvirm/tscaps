import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';
import type { TemplateContractContext } from '@core/templates/domain/contract/TemplateContractContext';

/**
 * One check over a template's raw `filters.svg` source. Reports every
 * breach it finds; an empty result means the source passes this rule.
 * Implementations are lexical and must never throw on malformed input.
 */
export interface FiltersSvgContractRule {
  check(source: string, context: TemplateContractContext): ContractViolation[];
}
