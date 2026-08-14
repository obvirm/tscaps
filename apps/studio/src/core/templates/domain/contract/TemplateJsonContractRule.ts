import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';
import type { TemplateContractContext } from '@core/templates/domain/contract/TemplateContractContext';

/**
 * One check over a template's parsed `template.json`. Receives the
 * raw parsed value — shape unverified, so implementations narrow
 * defensively and must never throw on malformed input — plus the
 * template's context, for checks that compare the declaration against
 * what the template actually ships. An empty result means the value
 * passes this rule.
 */
export interface TemplateJsonContractRule {
  check(templateJson: unknown, context: TemplateContractContext): ContractViolation[];
}
