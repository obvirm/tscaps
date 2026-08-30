import { describe, expect, it } from 'vitest';
import { BoundaryScoreLimitByCharsSegmentSplitter } from '@modules/splitting';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';

/** `scores` maps a word's index to the boundary score it carries. */
function segmentOf(text: string, scores: Readonly<Record<number, number>> = {}): Segment {
  const words = text.split(' ').map((word, i) => new Word({
    text: word,
    time: new TimeFragment(i, i + 1),
    boundaryScore: scores[i] ?? null,
  }));
  return new Segment({ lines: [new Line({ words })] });
}

function split(text: string, config: { maxChars: number; minChars: number }, scores?: Readonly<Record<number, number>>): string[] {
  const splitter = new BoundaryScoreLimitByCharsSegmentSplitter(config);
  return splitter.split([segmentOf(text, scores)]).map((segment) => segment.getText());
}

describe('BoundaryScoreLimitByCharsSegmentSplitter', () => {

  it('cuts after the highest-scored word inside the valid range', () => {
    expect(split('aaa bbb ccc ddd eee', { maxChars: 16, minChars: 6 }, { 1: 0.9, 2: 0.2 }))
      .toEqual(['aaa bbb', 'ccc ddd eee']);
  });

  it('takes the longest valid chunk when no word in range carries a score', () => {
    expect(split('aaa bbb ccc ddd eee', { maxChars: 16, minChars: 6 }))
      .toEqual(['aaa bbb ccc', 'ddd eee']);
  });

  it('keeps a word longer than the maximum whole', () => {
    expect(split('extraordinary', { maxChars: 5, minChars: 0 })).toEqual(['extraordinary']);
  });

  // The two bounds cannot always both hold, and which one gives way
  // depends on which side of the cut is stuck.
  describe('when the bounds conflict', () => {

    // No cut inside the maximum reaches the minimum, so the chunk is
    // short. Growing it past the maximum is not on the table.
    it('gives up the minimum to hold the maximum', () => {
      expect(split('the extraordinary x', { maxChars: 16, minChars: 6 }))
        .toEqual(['the', 'extraordinary x']);
    });

    // Every cut inside the maximum would strand a tail under the
    // minimum, so the tail is absorbed and the chunk overruns.
    it('gives up the maximum rather than strand a tail under the minimum', () => {
      expect(split('hello world again', { maxChars: 12, minChars: 6 }))
        .toEqual(['hello world again']);
    });
  });
});
