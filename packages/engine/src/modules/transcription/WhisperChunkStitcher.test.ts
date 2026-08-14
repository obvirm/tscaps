import { describe, expect, it } from 'vitest';
import { WhisperChunkStitcher, type WhisperChunk } from '@modules/transcription/WhisperChunkStitcher';

const CHUNK_LENGTH = 30;
const STRIDE = 5;

function chunk(text: string, start: number, end: number = start): WhisperChunk {
  return { text, timestamp: [start, end] };
}

function stitch(chunks: WhisperChunk[], audioDurationSeconds: number): WhisperChunk[] {
  return new WhisperChunkStitcher(CHUNK_LENGTH, STRIDE).stitch(chunks, audioDurationSeconds);
}

describe('WhisperChunkStitcher', () => {

  it('passes single-window output through untouched', () => {
    const chunks = [chunk('hello', 0, 1), chunk('world', 1, 2)];
    expect(stitch(chunks, 5)).toEqual(chunks);
  });

  it('returns an empty array for empty input', () => {
    expect(stitch([], 60)).toEqual([]);
  });

  it('detects two windows via a timestamp drop and crops each side at the midpoint by default', () => {
    const window0 = [chunk('a', 5, 6), chunk('past_midpoint', 27, 28)];
    const window1 = [chunk('warmup_dropped', 22, 23), chunk('c', 40, 41)];
    const result = stitch([...window0, ...window1], 45);
    expect(result.map((c) => c.text)).toEqual(['a', 'c']);
  });

  it('drops loop garbage from window 0 that lands past the smart boundary', () => {
    const window0 = [chunk('cool.', 26.06, 26.22), chunk('garbage', 29.98, 29.98), chunk('garbage', 29.98, 29.98)];
    const window1 = [chunk('Just', 26.46, 26.68), chunk('this', 26.68, 26.92)];
    const result = stitch([...window0, ...window1], 55);
    expect(result.map((c) => c.text)).toEqual(['cool.', 'Just', 'this']);
  });

  it('keeps window 0 content between the midpoint and the next window\'s first chunk (silence-in-overlap case)', () => {
    const window0 = [chunk('kept_by_smart_boundary', 26.06, 26.22), chunk('garbage', 29.98, 29.98)];
    const window1 = [chunk('Just', 26.46, 26.68)];
    const result = stitch([...window0, ...window1], 55);
    expect(result.map((c) => c.text)).toEqual(['kept_by_smart_boundary', 'Just']);
  });

  it('drops duplicate content when both windows emit it in the overlap', () => {
    const window0 = [chunk('early', 10, 11), chunk('shared', 26, 27), chunk('tail', 29, 29)];
    const window1 = [chunk('shared', 26, 27), chunk('later', 40, 41)];
    const result = stitch([...window0, ...window1], 45);
    expect(result.map((c) => c.text)).toEqual(['early', 'shared', 'later']);
    expect(result.filter((c) => c.text === 'shared')).toHaveLength(1);
  });

  it('drops last-window chunks whose anchor is past the audio end', () => {
    const window0 = [chunk('early', 10, 11), chunk('tail', 27, 28)];
    const window1 = [chunk('mid', 25, 26), chunk('past_end', 55, 55)];
    const result = stitch([...window0, ...window1], 40);
    expect(result.map((c) => c.text)).toEqual(['early', 'mid']);
  });

  it('crops three windows independently at each boundary', () => {
    const window0 = [chunk('a', 5, 6), chunk('w0_tail', 28, 29)];
    const window1 = [chunk('b', 25, 26), chunk('w1_tail', 47, 48)];
    const window2 = [chunk('c', 45, 46), chunk('d', 60, 61)];
    const result = stitch([...window0, ...window1, ...window2], 65);
    expect(result.map((c) => c.text)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignores chunks with two null timestamps when splitting and cropping', () => {
    const window0: WhisperChunk[] = [
      chunk('kept', 10, 11),
      { text: 'no_anchor', timestamp: [null, null] },
      chunk('garbage', 29.98, 29.98),
    ];
    const window1: WhisperChunk[] = [chunk('Just', 26.46, 26.68)];
    const result = stitch([...window0, ...window1], 55);
    expect(result.map((c) => c.text)).toEqual(['kept', 'Just']);
  });

  it('does not split when the next window\'s content is already ordered after the previous', () => {
    const chunks = [chunk('a', 10, 11), chunk('b', 25, 26), chunk('c', 40, 41)];
    const result = stitch(chunks, 55);
    expect(result).toEqual(chunks);
  });
});
