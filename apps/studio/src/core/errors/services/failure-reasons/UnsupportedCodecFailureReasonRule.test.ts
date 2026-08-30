import { describe, expect, it } from 'vitest';
import { UnsupportedCodecFailureReasonRule } from '@core/errors/services/failure-reasons/UnsupportedCodecFailureReasonRule';

const rule = new UnsupportedCodecFailureReasonRule();

function unsupported(message: string): DOMException {
  return new DOMException(message, 'NotSupportedError');
}

describe('UnsupportedCodecFailureReasonRule', () => {
  it('recognises the browser error itself', () => {
    expect(rule.matches(unsupported('no decoder for aac'))).toBe(true);
  });

  it('recognises it under the operation that wrapped it', () => {
    const wrapped = new Error('Audio extraction failed', { cause: unsupported('no decoder for aac') });

    expect(rule.matches(wrapped)).toBe(true);
  });

  /**
   * A step that tries several strategies reports each one's failure
   * side by side rather than as a chain, because no attempt caused
   * the next. The condition has to stay recognisable through any of
   * them: one strategy refusing the codec still leaves the codec as
   * the thing the user can act on.
   */
  it('recognises it in any attempt of a step that tried several', () => {
    const attempts = new AggregateError([
      new Error('the encoder is missing'),
      unsupported('no decoder for aac'),
    ], 'No audio decode path succeeded');

    expect(rule.matches(new Error('Audio extraction failed', { cause: attempts }))).toBe(true);
  });

  it('does not recognise a failure no attempt blamed on the codec', () => {
    const attempts = new AggregateError([
      new Error('the encoder is missing'),
      new DOMException('the device is out of space', 'QuotaExceededError'),
    ], 'No audio decode path succeeded');

    expect(rule.matches(new Error('Audio extraction failed', { cause: attempts }))).toBe(false);
  });

  it('survives a cause that points back into the chain', () => {
    const outer: { name: string; cause?: unknown } = { name: 'OuterError' };
    outer.cause = outer;

    expect(rule.matches(outer)).toBe(false);
  });
});
