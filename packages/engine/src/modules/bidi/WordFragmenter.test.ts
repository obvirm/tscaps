import { describe, expect, it } from 'vitest';
import { BidiJsAnalyzer } from '@modules/bidi/BidiJsAnalyzer';
import { CursiveScriptDetector } from '@modules/bidi/CursiveScriptDetector';
import { WordFragmenter } from '@modules/bidi/WordFragmenter';
import type { TextDirection } from '@modules/bidi/TextDirection';

const fragmenter = new WordFragmenter(new BidiJsAnalyzer(), new CursiveScriptDetector());

/** `text|direction` per fragment, in painting order. */
function paint(words: ReadonlyArray<string>, baseDirection: TextDirection): string[] {
  return fragmenter.fragment(words, baseDirection).map((f) => `${f.text}|${f.direction}`);
}

// The expectations below were taken from a run comparing this class's output
// against what Chromium and Firefox actually lay out for the same text. They
// describe the browsers' behaviour, not this implementation's.
describe('WordFragmenter', () => {

  it('leaves a left-to-right line in spoken order', () => {
    expect(paint(['The', 'quick', 'brown', 'fox'], 'ltr'))
      .toEqual(['The|ltr', 'quick|ltr', 'brown|ltr', 'fox|ltr']);
  });

  it('reverses a right-to-left line', () => {
    expect(paint(['مرحبا', 'بكم', 'في', 'تسكابس'], 'rtl'))
      .toEqual(['تسكابس|rtl', 'في|rtl', 'بكم|rtl', 'مرحبا|rtl']);
  });

  it('keeps an embedded foreign phrase reading in its own direction', () => {
    expect(paint(['قرأت', 'كتاب', 'The', 'Great', 'Gatsby', 'أمس'], 'rtl'))
      .toEqual(['أمس|rtl', 'The|ltr', 'Great|ltr', 'Gatsby|ltr', 'كتاب|rtl', 'قرأت|rtl']);
  });

  it('keeps an embedded right-to-left phrase in a left-to-right line', () => {
    expect(paint(['He', 'said', 'مرحبا', 'بكم', 'and', 'left.'], 'ltr'))
      .toEqual(['He|ltr', 'said|ltr', 'بكم|rtl', 'مرحبا|rtl', 'and|ltr', 'left.|ltr']);
  });

  it('places a foreign name by the base direction, not by its own script', () => {
    expect(paint(['tscaps', 'هو', 'الأفضل'], 'rtl'))
      .toEqual(['الأفضل|rtl', 'هو|rtl', 'tscaps|ltr']);
    expect(paint(['tscaps', 'هو', 'الأفضل'], 'ltr'))
      .toEqual(['tscaps|ltr', 'الأفضل|rtl', 'هو|rtl']);
  });

  it('keeps a closing full stop with its word when the base direction agrees', () => {
    expect(paint(['مرحبا', 'بكم', 'تسكابس.'], 'rtl'))
      .toEqual(['تسكابس.|rtl', 'بكم|rtl', 'مرحبا|rtl']);
  });

  // Declaring right-to-left text as a left-to-right paragraph is a real
  // configuration, and this is what it looks like: the full stop resolves to
  // the paragraph's own level and paints at the far end, away from the word it
  // belongs to. Both pieces still answer to that word.
  it('splits a word whose punctuation resolves away from its letters', () => {
    expect(paint(['مرحبا', 'بكم', 'تسكابس.'], 'ltr'))
      .toEqual(['تسكابس|rtl', 'بكم|rtl', 'مرحبا|rtl', '.|ltr']);

    const fragments = fragmenter.fragment(['مرحبا', 'بكم', 'تسكابس.'], 'ltr');
    const pieces = fragments.filter((f) => f.wordIndex === 2);
    expect(pieces).toHaveLength(2);
    expect(pieces.filter((f) => f.carriesWordTail)).toHaveLength(1);
  });

  it('splits brackets away from the phrase they wrap and closes the gap', () => {
    expect(paint(['نشرت', 'على', '(Product', 'Hunt)', 'أمس.'], 'rtl'))
      .toEqual(['أمس.|rtl', ')|rtl', 'Product|ltr', 'Hunt|ltr', '(|rtl', 'على|rtl', 'نشرت|rtl']);

    const fragments = fragmenter.fragment(['نشرت', 'على', '(Product', 'Hunt)', 'أمس.'], 'rtl');
    // No word separator paints between the bracket and the word beside it, so
    // the inter-word gap must not open there.
    expect(fragments.map((f) => f.joinedToPrevious))
      .toEqual([false, false, true, false, true, false, false]);
  });

  it('marks exactly one tail fragment per word', () => {
    const fragments = fragmenter.fragment(['قال', '[The', '"Big"', 'One]', 'ثم', 'صمت'], 'rtl');
    const tailsPerWord = new Map<number, number>();
    for (const fragment of fragments) {
      if (!fragment.carriesWordTail) continue;
      tailsPerWord.set(fragment.wordIndex, (tailsPerWord.get(fragment.wordIndex) ?? 0) + 1);
    }
    expect([...tailsPerWord.values()]).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('reports which fragments are written in a joining script', () => {
    const fragments = fragmenter.fragment(['قرأت', 'The', 'שלום'], 'rtl');
    const joining = new Map(fragments.map((f) => [f.text, f.charactersJoin]));
    expect(joining.get('قرأت')).toBe(true);
    expect(joining.get('The')).toBe(false);
    expect(joining.get('שלום')).toBe(false);
  });

  it('yields nothing for an empty line and skips words with no characters', () => {
    expect(fragmenter.fragment([], 'rtl')).toEqual([]);
    expect(paint(['', 'مرحبا', ''], 'rtl')).toEqual(['مرحبا|rtl']);
  });
});
