import { describe, expect, it } from 'vitest';
import { CursiveScriptDetector } from '@modules/bidi/CursiveScriptDetector';

const detector = new CursiveScriptDetector();

describe('CursiveScriptDetector', () => {

  it('recognizes scripts whose letters connect', () => {
    expect(detector.isCursive('مرحبا')).toBe(true);
    expect(detector.isCursive('ویدیو')).toBe(true);
    expect(detector.isCursive('ہوں')).toBe(true);
  });

  // Right-to-left is not the same question: Hebrew reads right to left and its
  // letters still stand alone, so it can be painted letter by letter.
  it('does not mistake right-to-left for joining', () => {
    expect(detector.isCursive('שלום עולם')).toBe(false);
  });

  it('leaves scripts whose letters stand alone', () => {
    expect(detector.isCursive('The quick brown fox')).toBe(false);
    expect(detector.isCursive('Привет мир')).toBe(false);
    expect(detector.isCursive('こんにちは')).toBe(false);
    expect(detector.isCursive('')).toBe(false);
  });

  it('flags a mixed text as joining, since one of its words is', () => {
    expect(detector.isCursive('tscaps مرحبا')).toBe(true);
  });
});
