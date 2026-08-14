import type { FailureReason } from '@core/errors/domain/FailureReason';
import type { FailureReasonRule } from '@core/errors/domain/FailureReasonRule';

/**
 * Recognises the browser refusing to decode a media stream because it
 * cannot handle the codec or container the file uses.
 *
 * WebCodecs raises `NotSupportedError` when asked to configure a
 * decoder for a codec the engine does not implement, and
 * `EncodingError` when the underlying decoder rejects the bitstream
 * mid-decode — Web Audio's `decodeAudioData` also uses the second on
 * Safari to reject containers it cannot parse, so both names travel
 * to the same user-facing advice ("convert to a widely-supported
 * format"). Matching is by error name because messages are localised
 * and worded differently per engine.
 *
 * The `cause` chain is followed, so the condition stays recognisable
 * after an operation has wrapped the underlying browser error in one
 * of its own.
 */
export class UnsupportedCodecFailureReasonRule implements FailureReasonRule {

  private static readonly UNSUPPORTED_CODEC_ERROR_NAMES: readonly string[] = [
    'NotSupportedError',
    'EncodingError',
  ];

  private static readonly MAX_CAUSE_DEPTH = 8;

  readonly reason: FailureReason = 'codec-unsupported';

  matches(error: unknown): boolean {
    let candidate = error;
    for (let depth = 0; depth < UnsupportedCodecFailureReasonRule.MAX_CAUSE_DEPTH; depth += 1) {
      if (typeof candidate !== 'object' || candidate === null) return false;
      if (this.describesUnsupportedCodec(candidate)) return true;
      candidate = (candidate as { cause?: unknown }).cause;
    }
    return false;
  }

  private describesUnsupportedCodec(candidate: object): boolean {
    const name = (candidate as { name?: unknown }).name;
    return typeof name === 'string'
      && UnsupportedCodecFailureReasonRule.UNSUPPORTED_CODEC_ERROR_NAMES.includes(name);
  }
}
