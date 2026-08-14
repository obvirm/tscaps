import { describe, expect, it } from 'vitest';
import { CssVarReferenceScanner } from '@modules/css/CssVarReferenceScanner';

const scanner = new CssVarReferenceScanner();

describe('CssVarReferenceScanner', () => {

  it('finds properties substituted with var()', () => {
    expect(scanner.scan('.word { color: var(--tscaps-primary-color, #fff); }'))
      .toEqual(new Set(['--tscaps-primary-color']));
    expect(scanner.scan('.word { margin: 0 var( --a ) var(--b); }'))
      .toEqual(new Set(['--a', '--b']));
  });

  // A property a stylesheet only ever tests is still a property it reads.
  // Missing it would let the renderer drop the value the query needs, and
  // the rules behind that query would never apply.
  it('finds properties tested in a style query', () => {
    expect(scanner.scan('@container style(--tscaps-text-direction: rtl) { .line { margin: 0; } }'))
      .toEqual(new Set(['--tscaps-text-direction']));
    expect(scanner.scan('@container named style( --a : 1 ) { .word { top: 0; } }'))
      .toEqual(new Set(['--a']));
  });

  it('reports a property both substituted and tested only once', () => {
    const css = '@container style(--dir: rtl) { .line { left: var(--dir); } }';
    expect(scanner.scan(css)).toEqual(new Set(['--dir']));
  });

  it('finds nothing in a stylesheet that reads no custom property', () => {
    expect(scanner.scan('.word { color: red; }')).toEqual(new Set());
  });
});
