import { LogitsProcessor, type Tensor } from '@huggingface/transformers';

// Full repetitions the tail must show before the pattern is trusted as
// degenerate. Two verbatim repetitions of a phrase can be legitimate
// emphasis; five cannot realistically be. This is a floor — longer
// per-period windows still need at least this many repetitions.
const MIN_FULL_PERIODS = 5;

// Total token count the repeating tail must reach before it counts. Short
// repeated tails — a 3-word chorus repeated a handful of times, a hymn
// refrain — can be legitimate speech and stay below this bar. The
// combination `MIN_FULL_PERIODS` full periods AND `MIN_REPETITION_TOKENS`
// total tokens filters those out while still catching the multi-hundred-
// token degenerate loops Whisper falls into. This is a floor on total
// length, not a cap on period size.
const MIN_REPETITION_TOKENS = 50;

/**
 * Cuts short a generation that has degenerated into a repetition loop.
 *
 * Detection: the tail of the generated sequence contains at least
 * `MIN_FULL_PERIODS` verbatim repetitions of some unit AND spans at
 * least `MIN_REPETITION_TOKENS` tokens. On detection every logit
 * except end-of-sequence is forced to `-Infinity`, so the next step
 * emits end-of-sequence and the generation stops without burning the
 * rest of the token budget on garbage.
 *
 * The guard only ends generations early; it never alters the content
 * of a healthy one.
 */
export class WhisperLoopAbortLogitsProcessor extends LogitsProcessor {
  private fired = false;

  constructor(private readonly endOfSequenceTokenId: number) {
    super();
  }

  _call(inputIds: bigint[][], logits: Tensor): Tensor {
    for (let batch = 0; batch < inputIds.length; batch++) {
      if (!this.endsInRepetitionLoop(inputIds[batch] ?? [])) continue;
      this.fired = true;
      this.forceEndOfSequence(batch, logits);
    }
    return logits;
  }

  /** True when the guard fired since the previous call; reading resets it. */
  consumeFired(): boolean {
    const fired = this.fired;
    this.fired = false;
    return fired;
  }

  private endsInRepetitionLoop(sequence: readonly bigint[]): boolean {
    const maxPeriod = Math.floor(sequence.length / MIN_FULL_PERIODS);
    for (let period = 1; period <= maxPeriod; period++) {
      const windowSize = this.detectionWindowFor(period);
      if (windowSize > sequence.length) continue;
      if (this.isPeriodic(sequence, sequence.length - windowSize, period)) return true;
    }
    return false;
  }

  // Smallest multiple of `period` that satisfies both floors: at least
  // `MIN_FULL_PERIODS` full repetitions, and at least `MIN_REPETITION_TOKENS`
  // total tokens. Rounding up to a multiple of `period` keeps `isPeriodic`
  // aligned to full repetitions.
  private detectionWindowFor(period: number): number {
    const byPeriodFloor = period * MIN_FULL_PERIODS;
    const byTokenFloor = period * Math.ceil(MIN_REPETITION_TOKENS / period);
    return Math.max(byPeriodFloor, byTokenFloor);
  }

  private isPeriodic(sequence: readonly bigint[], from: number, period: number): boolean {
    for (let i = from + period; i < sequence.length; i++) {
      if (sequence[i] !== sequence[i - period]) return false;
    }
    return true;
  }

  private forceEndOfSequence(batch: number, logits: Tensor): void {
    const row = (logits as unknown as Array<{ data: Float32Array }>)[batch];
    if (!row) return;
    row.data.fill(-Infinity);
    row.data[this.endOfSequenceTokenId] = 0;
  }
}
