import type { FailureReason } from '@core/errors/domain/FailureReason';
import type { FailureReasonRule } from '@core/errors/domain/FailureReasonRule';

/**
 * Recognises the browser refusing to store more data for this origin,
 * across the storage APIs the app writes through (OPFS, IndexedDB,
 * Cache).
 *
 * Matching is by error name rather than by message: messages are
 * localized and worded differently per engine, while the names are
 * specified. Chromium and Safari raise `QuotaExceededError`; Gecko
 * raises `NS_ERROR_DOM_QUOTA_REACHED`. Engines old enough to predate
 * those names are still caught through the legacy `DOMException`
 * codes.
 *
 * The `cause` chain is followed, so the condition stays recognisable
 * after an operation has wrapped it in an error of its own.
 */
export class StorageFullFailureReasonRule implements FailureReasonRule {

  private static readonly QUOTA_ERROR_NAMES: readonly string[] = [
    'QuotaExceededError',
    'NS_ERROR_DOM_QUOTA_REACHED',
  ];

  private static readonly LEGACY_QUOTA_EXCEPTION_CODES: readonly number[] = [22, 1014];

  private static readonly MAX_CAUSE_DEPTH = 8;

  readonly reason: FailureReason = 'storage-full';

  matches(error: unknown): boolean {
    let candidate = error;
    for (let depth = 0; depth < StorageFullFailureReasonRule.MAX_CAUSE_DEPTH; depth += 1) {
      if (typeof candidate !== 'object' || candidate === null) return false;
      if (this.describesQuotaFailure(candidate)) return true;
      candidate = (candidate as { cause?: unknown }).cause;
    }
    return false;
  }

  private describesQuotaFailure(candidate: object): boolean {
    const name = (candidate as { name?: unknown }).name;
    if (typeof name === 'string' && StorageFullFailureReasonRule.QUOTA_ERROR_NAMES.includes(name)) {
      return true;
    }
    return this.carriesLegacyQuotaCode(candidate);
  }

  /**
   * `DOMException.code` is the only signal on engines that raise a
   * quota failure under a generic name. It is read exclusively off a
   * real `DOMException` because those numbers collide with unrelated
   * error codes elsewhere.
   */
  private carriesLegacyQuotaCode(candidate: object): boolean {
    if (typeof DOMException === 'undefined' || !(candidate instanceof DOMException)) return false;
    return StorageFullFailureReasonRule.LEGACY_QUOTA_EXCEPTION_CODES.includes(candidate.code);
  }
}
