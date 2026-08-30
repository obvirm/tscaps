import { describe, expect, it } from 'vitest';
import { FontFaceSourceTrimmer } from '@core/fonts/services/FontFaceSourceTrimmer';

/**
 * What a rule offers, and what an export is willing to carry.
 *
 * Every `url()` a rule lists is fetched and inlined as a data URI into
 * the stylesheet that ships with each rendered frame, so a family
 * offered as woff2 *and* woff rode into every frame twice — the second
 * copy for a browser that cannot be the one rendering.
 *
 * Assertions are on which sources survive, never on the exact text: the
 * spacing is nobody's promise.
 */

const trimmer = new FontFaceSourceTrimmer();

function sourcesIn(cssText: string): string[] {
  return [...cssText.matchAll(/url\(([^)]*)\)|local\(([^)]*)\)/g)].map((m) => (m[1] ?? m[2])!.trim());
}

describe('a rule offering both formats', () => {
  const BOTH = `@font-face { font-family: 'Lalezar'; font-weight: 400; `
    + `src: url(./files/lalezar-latin-400-normal.woff2) format('woff2'), `
    + `url(./files/lalezar-latin-400-normal.woff) format('woff'); `
    + `unicode-range: U+0000-00FF; }`;

  it('keeps the woff2 and drops the woff', () => {
    expect(sourcesIn(trimmer.trim(BOTH))).toEqual(['./files/lalezar-latin-400-normal.woff2']);
  });

  it('leaves every other descriptor alone', () => {
    const trimmed = trimmer.trim(BOTH);
    expect(trimmed).toContain("font-family: 'Lalezar'");
    expect(trimmed).toContain('font-weight: 400');
    expect(trimmed).toContain('unicode-range: U+0000-00FF');
  });
});

describe('a rule with nothing to drop', () => {
  it('leaves a woff2-only rule exactly as it was', () => {
    const css = `@font-face { font-family: 'Komika Axis'; src: url(/assets/komika-axis.woff2) format('woff2'); }`;
    expect(trimmer.trim(css)).toBe(css);
  });

  it('leaves an uploaded font on its own format', () => {
    const css = `@font-face { font-family: 'Uploaded'; src: url(blob:http://localhost/abc) format('truetype'); }`;
    expect(trimmer.trim(css)).toBe(css);
  });

  // Without a woff2 to supersede it, the woff is the only file there is.
  it('keeps a lone woff', () => {
    const css = `@font-face { font-family: 'Old'; src: url(/assets/old.woff) format('woff'); }`;
    expect(trimmer.trim(css)).toBe(css);
  });

  it('leaves a rule with no src alone', () => {
    const css = `@font-face { font-family: 'Bare'; unicode-range: U+0000-00FF; }`;
    expect(trimmer.trim(css)).toBe(css);
  });
});

describe('sources that are not files', () => {
  it('keeps a local face, which costs no bytes at all', () => {
    const css = `@font-face { font-family: 'Inter'; src: local('Inter'), `
      + `url(/assets/inter.woff2) format('woff2'), url(/assets/inter.woff) format('woff'); }`;
    expect(sourcesIn(trimmer.trim(css))).toEqual(["'Inter'", '/assets/inter.woff2']);
  });

  // A comma inside the value must not read as a source boundary.
  it('survives a url carrying a comma', () => {
    const css = `@font-face { font-family: 'Q'; src: url("/assets/a,b.woff2") format('woff2'), `
      + `url("/assets/a,b.woff") format('woff'); }`;
    expect(sourcesIn(trimmer.trim(css))).toEqual(['"/assets/a,b.woff2"']);
  });
});
