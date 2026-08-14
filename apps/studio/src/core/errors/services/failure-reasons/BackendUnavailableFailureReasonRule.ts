import { WhisperDeviceUnavailableError } from '@tscaps/engine';
import type { FailureReason } from '@core/errors/domain/FailureReason';
import type { FailureReasonRule } from '@core/errors/domain/FailureReasonRule';

/**
 * Recognises a runtime backend the user asked an operation to run on
 * turning out to be unavailable — either the browser does not expose
 * the API that backend relies on (typically WebGPU), or the assets
 * needed for it are missing. Generic enough for any subsystem that
 * lets the user pick a backend to reuse; today the only such subsystem
 * is transcription.
 *
 * Matches by error name across the `cause` chain, mirroring the other
 * rules in this folder. The name string is read from the engine class
 * so a rename or spelling change on either side of the worker boundary
 * is caught at compile time.
 */
export class BackendUnavailableFailureReasonRule implements FailureReasonRule {

  private static readonly MAX_CAUSE_DEPTH = 8;

  readonly reason: FailureReason = 'backend-unavailable';

  matches(error: unknown): boolean {
    let candidate = error;
    for (let depth = 0; depth < BackendUnavailableFailureReasonRule.MAX_CAUSE_DEPTH; depth += 1) {
      if (typeof candidate !== 'object' || candidate === null) return false;
      const name = (candidate as { name?: unknown }).name;
      if (name === WhisperDeviceUnavailableError.ERROR_NAME) return true;
      candidate = (candidate as { cause?: unknown }).cause;
    }
    return false;
  }
}
