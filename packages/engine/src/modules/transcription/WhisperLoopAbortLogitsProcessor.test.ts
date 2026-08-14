import { describe, expect, it } from 'vitest';
import type { Tensor } from '@huggingface/transformers';
import { WhisperLoopAbortLogitsProcessor } from '@modules/transcription/WhisperLoopAbortLogitsProcessor';

const END_OF_SEQUENCE_TOKEN_ID = 0;

function repeat(unit: number[], times: number): number[] {
  return Array.from({ length: times }, () => unit).flat();
}

function guardFires(tokens: number[]): boolean {
  const guard = new WhisperLoopAbortLogitsProcessor(END_OF_SEQUENCE_TOKEN_ID);
  const inputIds = [tokens.map((token) => BigInt(token))];
  const logits = [{ data: new Float32Array(100) }] as unknown as Tensor;
  guard._call(inputIds, logits);
  return guard.consumeFired();
}

describe('WhisperLoopAbortLogitsProcessor', () => {

  it('does not fire on an empty sequence', () => {
    expect(guardFires([])).toBe(false);
  });

  it('does not fire on a non-repeating sequence longer than the total-tokens floor', () => {
    const unique = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(guardFires(unique)).toBe(false);
  });

  it('does not fire on a 3-token chorus repeated 5 times (15 tokens below the 50-token floor)', () => {
    expect(guardFires(repeat([1, 2, 3], 5))).toBe(false);
  });

  it('fires on a 3-token loop that reaches the 50-token floor (17 reps = 51 tokens)', () => {
    expect(guardFires(repeat([1, 2, 3], 17))).toBe(true);
  });

  it('fires on a 12-token loop with 5 full reps (matches the Whisper "like, oh, I\'m going to be" loop)', () => {
    const unit = Array.from({ length: 12 }, (_, i) => i + 1);
    expect(guardFires(repeat(unit, 5))).toBe(true);
  });

  it('does not fire on a 12-token loop with only 4 reps (48 tokens below the total floor and below the 5-rep floor)', () => {
    const unit = Array.from({ length: 12 }, (_, i) => i + 1);
    expect(guardFires(repeat(unit, 4))).toBe(false);
  });

  it('fires on a large-period loop as long as 5 reps and 50 tokens are both met (30-token unit x 5 reps)', () => {
    const unit = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(guardFires(repeat(unit, 5))).toBe(true);
  });

  it('does not fire on a large-period loop with only 4 reps, even if the total spans 120 tokens', () => {
    const unit = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(guardFires(repeat(unit, 4))).toBe(false);
  });

  it('fires only on the tail — a healthy prefix followed by a loop still fires', () => {
    const healthyPrefix = Array.from({ length: 50 }, (_, i) => 100 + i);
    const loop = repeat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 5);
    expect(guardFires([...healthyPrefix, ...loop])).toBe(true);
  });

  it('ignores a repetition that lives in the middle of the sequence when the tail is not periodic', () => {
    const midLoop = repeat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 5);
    const healthyTail = Array.from({ length: 60 }, (_, i) => 200 + i);
    expect(guardFires([...midLoop, ...healthyTail])).toBe(false);
  });

  it('forces end-of-sequence on the logits row when it fires', () => {
    const guard = new WhisperLoopAbortLogitsProcessor(END_OF_SEQUENCE_TOKEN_ID);
    const loop = repeat([1, 2, 3], 17);
    const inputIds = [loop.map((token) => BigInt(token))];
    const row = { data: new Float32Array(100).fill(1.5) };
    const logits = [row] as unknown as Tensor;
    guard._call(inputIds, logits);
    expect(row.data[END_OF_SEQUENCE_TOKEN_ID]).toBe(0);
    expect(row.data[END_OF_SEQUENCE_TOKEN_ID + 1]).toBe(-Infinity);
    expect(row.data[99]).toBe(-Infinity);
  });

  it('consumeFired resets the fired flag after reading', () => {
    const guard = new WhisperLoopAbortLogitsProcessor(END_OF_SEQUENCE_TOKEN_ID);
    const loop = repeat([1, 2, 3], 17);
    const inputIds = [loop.map((token) => BigInt(token))];
    const logits = [{ data: new Float32Array(100) }] as unknown as Tensor;
    guard._call(inputIds, logits);
    expect(guard.consumeFired()).toBe(true);
    expect(guard.consumeFired()).toBe(false);
  });
});
