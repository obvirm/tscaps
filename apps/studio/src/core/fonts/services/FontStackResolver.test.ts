import { describe, expect, it } from 'vitest';
import { FontScriptClassifier } from '@core/fonts/services/FontScriptClassifier';
import { FontStackResolver } from '@core/fonts/services/FontStackResolver';

/**
 * Which face leads a stack, and when a stand-in is the wrong answer.
 *
 * The stand-in mechanism was built for Arabic and Hebrew, where the
 * premise holds without exception: no Latin family in the catalog draws
 * either, so a caption in those scripts always wants somebody else's
 * face at the front. Cyrillic and Greek break that premise — sixteen of
 * these families ship Cyrillic — and a stand-in applied to one of them
 * would put a font the reader did not pick in front of one that already
 * fits.
 *
 * The stack's first family decides the baseline and the strut for every
 * line whether or not it draws a glyph, so leading is not a detail of
 * which picture appears. It is the metrics of the caption.
 */

const resolver = new FontStackResolver();
const classifier = new FontScriptClassifier();

const RUSSIAN = 'Это русские субтитры';
const HINDI = 'यह हिंदी उपशीर्षक है';
const ARABIC = 'هذه ترجمة عربية';

/** The stack a caption of `text` renders under, when the reader picked `family`. */
function stackFor(family: string, text: string): string {
  return resolver.resolveForScript(family, classifier.classifyWithLanguage(text));
}

/** The family the browser takes its line metrics from. */
function leaderOf(stack: string): string {
  return stack.split(',')[0]!.trim().replaceAll("'", '');
}

describe('a family that cannot draw the script', () => {

  it('is led by the stand-in, so metrics come from the face that paints', () => {
    expect(leaderOf(stackFor('Anton', RUSSIAN))).toBe('Oswald Variable');
  });

  it('keeps the reader\'s choice in the stack behind the stand-in', () => {
    expect(stackFor('Anton', RUSSIAN)).toContain("'Anton'");
  });

  it('reaches Poppins for Devanagari, the one family in the catalog that draws it', () => {
    expect(leaderOf(stackFor('Bebas Neue', HINDI))).toBe('Poppins');
  });
});

describe('a family that draws the script itself', () => {

  // The mechanism's premise fails here, and failing quietly would look
  // like an improvement: the captions render, in a face nobody chose.
  it('keeps the lead rather than being displaced by a stand-in', () => {
    expect(leaderOf(stackFor('Caveat Variable', RUSSIAN))).toBe('Caveat Variable');
  });

  it('carries no stand-in for that script at all', () => {
    expect(resolver.resolve('Inter Variable')).not.toContain('Oswald');
  });

  it('still takes a stand-in for the scripts it does not draw', () => {
    expect(leaderOf(stackFor('Inter Variable', ARABIC))).toBe('Vazirmatn Variable');
  });
});

describe('the scripts the mechanism was built for', () => {

  it('leads with the Arabic face for a family with no Arabic glyphs', () => {
    expect(leaderOf(stackFor('Anton', ARABIC))).toBe('Lalezar');
  });

  it('leaves a Latin caption led by the family the reader picked', () => {
    expect(leaderOf(stackFor('Anton', 'Hello there'))).toBe('Anton');
  });
});
