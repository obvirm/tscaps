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
 * Both `cause` and the `errors` of an `AggregateError` are followed,
 * so the condition stays recognisable after an operation has wrapped
 * the underlying browser error in one of its own, and after a step
 * that tried several strategies reported all of their failures side
 * by side. Recognising it through any branch is deliberate: one
 * strategy refusing the codec while another dies of something else
 * still leaves the codec as the reason the user can act on.
 */
export class UnsupportedCodecFailureReasonRule implements FailureReasonRule {

  private static readonly UNSUPPORTED_CODEC_ERROR_NAMES: readonly string[] = [
    'NotSupportedError',
    'EncodingError',
  ];

  private static readonly MAX_DEPTH = 8;

  readonly reason: FailureReason = 'codec-unsupported';

  matches(error: unknown): boolean {
    return this.matchesWithin(error, 0, new Set<object>());
  }

  private matchesWithin(candidate: unknown, depth: number, seen: Set<object>): boolean {
    if (depth >= UnsupportedCodecFailureReasonRule.MAX_DEPTH) return false;
    if (typeof candidate !== 'object' || candidate === null) return false;
    if (seen.has(candidate)) return false;
    seen.add(candidate);
    if (this.describesUnsupportedCodec(candidate)) return true;
    return this.linkedTo(candidate).some((linked) => this.matchesWithin(linked, depth + 1, seen));
  }

  private linkedTo(candidate: object): unknown[] {
    const branches = (candidate as { errors?: unknown }).errors;
    const linked = Array.isArray(branches) ? [...branches] : [];
    linked.push((candidate as { cause?: unknown }).cause);
    return linked;
  }

  private describesUnsupportedCodec(candidate: object): boolean {
    const name = (candidate as { name?: unknown }).name;
    return typeof name === 'string'
      && UnsupportedCodecFailureReasonRule.UNSUPPORTED_CODEC_ERROR_NAMES.includes(name);
  }
}
