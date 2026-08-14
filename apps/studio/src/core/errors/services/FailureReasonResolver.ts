import type { FailureReason } from '@core/errors/domain/FailureReason';
import type { FailureReasonRule } from '@core/errors/domain/FailureReasonRule';

/**
 * Names the condition behind a failure by consulting its rules in
 * order and taking the first match.
 *
 * Order is the tie-break when two conditions could both describe one
 * failure, so the composition root lists the more specific rules
 * first. Resolves to `unknown` when no rule recognises the value,
 * which callers treat as "describe the operation, say nothing about
 * the cause" rather than as an error.
 */
export class FailureReasonResolver {
  constructor(private readonly rules: readonly FailureReasonRule[]) {}

  resolve(error: unknown): FailureReason {
    for (const rule of this.rules) {
      if (rule.matches(error)) return rule.reason;
    }
    return 'unknown';
  }
}
