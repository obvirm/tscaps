import type { FailureReason } from '@core/errors/domain/FailureReason';

/**
 * Recognises one condition among arbitrary thrown values.
 *
 * A rule answers only for the condition it names and leaves every
 * other value alone, so naming a new condition means adding a rule
 * rather than editing one.
 */
export interface FailureReasonRule {
  readonly reason: FailureReason;

  /**
   * Whether `error` was caused by this rule's condition. Receives the
   * value as thrown, so implementations that care about wrapping walk
   * the `cause` chain themselves.
   */
  matches(error: unknown): boolean;
}
