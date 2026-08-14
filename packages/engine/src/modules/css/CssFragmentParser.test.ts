import { describe, expect, it } from 'vitest';
import { CssMinifier } from '@modules/css/CssMinifier';
import { CssFragmentParser, type CssFragmentPart } from '@modules/css/CssFragmentParser';

function parse(css: string): CssFragmentPart[] {
  return new CssFragmentParser(new CssMinifier()).parse(css);
}

function properties(css: string): string[] {
  return parse(css).filter((part) => part.kind === 'declaration').map((part) => part.property);
}

function preludes(css: string): string[] {
  return parse(css).filter((part) => part.kind === 'block').map((part) => part.prelude);
}

/** What is left after cutting one part out, which is how a caller rewrites part of a fragment. */
function withoutPartAt(css: string, index: number): string {
  const part = parse(css)[index]!;
  return css.slice(0, part.start) + css.slice(part.end);
}

describe('a fragment of plain declarations', () => {
  it('reports each one split into property and value', () => {
    const parts = parse('color: gold; font-size: 3cqh;');
    expect(parts.map((part) => part.kind === 'declaration' && part.value)).toEqual(['gold', '3cqh']);
  });

  it('reports a last declaration that was never terminated', () => {
    expect(properties('color: gold; opacity: 0.5')).toEqual(['color', 'opacity']);
  });

  it('reports a value holding braces-free functions whole', () => {
    const parts = parse('animation: pop 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;');
    expect(parts[0]!.kind === 'declaration' && parts[0]!.value)
      .toBe('pop 0.3s cubic-bezier(0.22, 1, 0.36, 1) both');
  });
});

describe('a declaration nested inside a block', () => {
  it('is not reported, because it does not apply to the element', () => {
    expect(properties('color: gold; &:hover { color: red; }')).toEqual(['color']);
  });

  it('is not reported from inside a keyframe stop either', () => {
    expect(properties('@keyframes pop { from { opacity: 0 } to { opacity: 1 } }')).toEqual([]);
  });
});

describe('a block', () => {
  it('is reported with what precedes its braces', () => {
    expect(preludes('&:hover { color: red } @keyframes pop { from { opacity: 0 } }'))
      .toEqual(['&:hover', '@keyframes pop']);
  });

  it('runs to the end of the input when it was never closed', () => {
    const parts = parse('@keyframes pop { from { opacity: 0 }');
    expect(parts).toHaveLength(1);
    expect(parts[0]!.text).toBe('@keyframes pop { from { opacity: 0 }');
  });
});

describe('a comment', () => {
  it('never becomes a part of its own', () => {
    expect(properties('/* the look */ color: gold;')).toEqual(['color']);
  });

  it('is out of the text a part reports, but inside the span that part covers', () => {
    const source = 'color: /* was red */ gold;';
    const part = parse(source)[0]!;
    expect(part.text).not.toContain('was red');
    expect(part.kind === 'declaration' && part.value).toBe('gold');
    expect(withoutPartAt(source, 0)).toBe('');
  });

  it('hides a brace that would otherwise open a block', () => {
    expect(preludes('color: gold; /* &:hover { */ opacity: 1;')).toEqual([]);
  });
});

describe('a string literal', () => {
  it('hides a brace it contains', () => {
    expect(preludes("content: '{'; color: gold;")).toEqual([]);
  });

  it('hides a semicolon it contains, so the declaration stays whole', () => {
    const parts = parse("content: 'a; b'; color: gold;");
    expect(parts.map((part) => part.kind === 'declaration' && part.value)).toEqual(["'a; b'", 'gold']);
  });
});

describe('the offsets a part carries', () => {
  it('cut a declaration out and leave the rest exactly as written', () => {
    expect(withoutPartAt('color: gold;\nopacity: 0.5;\nfont-size: 3cqh;', 1))
      .toBe('color: gold;\nfont-size: 3cqh;');
  });

  it('cut a block out without touching the declarations around it', () => {
    expect(withoutPartAt('color: gold;\n@keyframes pop { from { opacity: 0 } }\nopacity: 1;', 1))
      .toBe('color: gold;\nopacity: 1;');
  });
});
