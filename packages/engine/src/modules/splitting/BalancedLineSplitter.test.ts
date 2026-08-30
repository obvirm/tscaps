import { describe, expect, it } from 'vitest';
import { BalancedLineSplitter } from '@modules/splitting';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';

function segmentOf(text: string): Segment {
  const words = text.split(' ').map((word, i) => new Word({ text: word, time: new TimeFragment(i, i + 1) }));
  return new Segment({ lines: [new Line({ words })] });
}

function linesOf(segment: Segment): string[] {
  return segment.lines.map((line) => line.getText());
}

function split(text: string, config: { maxCharsPerLine: number; minCharsPerLine?: number; maxLines?: number; minLines?: number }): string[] {
  const splitter = new BalancedLineSplitter({
    maxLines: config.maxLines ?? 3,
    minLines: config.minLines ?? 1,
    maxCharsPerLine: config.maxCharsPerLine,
    ...(config.minCharsPerLine === undefined ? {} : { minCharsPerLine: config.minCharsPerLine }),
  });
  return linesOf(splitter.split([segmentOf(text)])[0]!);
}

describe('BalancedLineSplitter', () => {
  it('balances the character count across lines', () => {
    expect(split('no one told me', { maxCharsPerLine: 6 })).toEqual(['no one', 'told', 'me']);
  });

  it('keeps a segment whole when it already fits one line', () => {
    expect(split('no one told me', { maxCharsPerLine: 30 })).toEqual(['no one told me']);
  });

  it('never breaks a word', () => {
    expect(split('extraordinary', { maxCharsPerLine: 4 })).toEqual(['extraordinary']);
  });

  describe('with a minimum line length', () => {
    it('drops to one line fewer rather than leave a line under the floor', () => {
      expect(split('no one told me', { maxCharsPerLine: 6, minCharsPerLine: 5 })).toEqual(['no one', 'told me']);
    });

    it('keeps the segment whole when no break clears the floor', () => {
      expect(split('a computer', { maxCharsPerLine: 6, minCharsPerLine: 5 })).toEqual(['a computer']);
    });

    it('splits normally when every line clears the floor', () => {
      expect(split('nobody knows what i did', { maxCharsPerLine: 8, minCharsPerLine: 5 })).toEqual([
        'nobody', 'knows what', 'i did',
      ]);
    });

    it('counts the separator between words toward a line length', () => {
      // "no one" is 6 with the gap and 5 without it; a floor of 6 keeps
      // the break that a floor counting only letters would reject.
      expect(split('no one told me', { maxCharsPerLine: 6, minCharsPerLine: 6 })).toEqual(['no one', 'told me']);
    });

    it('accepts every split when the floor is absent', () => {
      expect(split('a computer', { maxCharsPerLine: 6 })).toEqual(['a', 'computer']);
    });
  });
});
