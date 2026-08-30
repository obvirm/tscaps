import { describe, expect, it } from 'vitest';
import type { Document } from '@tscaps/engine';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { DrawableFamilyResolver } from '@core/fonts/services/DrawableFamilyResolver';
import { FontScriptClassifier } from '@core/fonts/services/FontScriptClassifier';
import { FontStackResolver } from '@core/fonts/services/FontStackResolver';
import { SheetFontFamilyCollector } from '@core/fonts/services/SheetFontFamilyCollector';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { SheetCaptionTextCollector } from '@core/sheets/services/SheetCaptionTextCollector';

/**
 * Which faces an export is made to carry.
 *
 * A chosen family is emitted with a stand-in appended for each script it
 * cannot draw, and everything collected here is embedded as a data URI
 * in the stylesheet that ships with every rendered frame. Latin-only
 * captions were carrying all three stand-ins: their Latin subsets do
 * cover the text, so filtering by `unicode-range` alone waves them
 * through, and four fonts rode along where one drew anything.
 *
 * A stand-in earns its bytes when the text holds a character of the
 * script it is there for, and not otherwise.
 */

const resolver = new FontStackResolver();

const collector = new SheetFontFamilyCollector(
  resolver,
  new DrawableFamilyResolver(resolver),
  new FontScriptClassifier(),
  new SheetCaptionTextCollector(),
);

// A heavy display face, whose stand-ins are a different family per script.
const CHOSEN = 'Komika Axis';

const sheet = { id: 'main', template: { styleControls: [] } } as unknown as Sheet;

function documentSaying(text: string): Document {
  const words = text.split(' ').map((displayText, i) => ({ id: `w${i}`, displayText }));
  const segments = [{ id: 's1', getWords: () => words, lines: [{ words }] }];
  return { sections: [{ kind: 'main', segments }] } as unknown as Document;
}

function familiesFor(text: string): Set<string> {
  return collector.collect({
    sheet,
    document: documentSaying(text),
    inlineStyles: { '--tscaps-font-family': resolver.resolve(CHOSEN) },
    sheetCss: '',
    elementStyles: ElementStyles.empty(),
  });
}

describe('the stand-ins a sheet carries', () => {
  it('carries none of them for text nobody wrote a right-to-left character in', () => {
    expect(familiesFor('the quick brown fox')).toEqual(new Set([CHOSEN]));
  });

  it('carries the Hebrew face, and only it, for Hebrew text', () => {
    expect(familiesFor('שלום עולם')).toEqual(new Set([CHOSEN, 'Heebo Variable']));
  });

  // Urdu is the Arabic script in another tradition and no letter separates
  // them, so Arabic characters have to keep the Nastaliq face reachable.
  it('carries both Arabic-script faces for Arabic text', () => {
    expect(familiesFor('مرحبا بالعالم')).toEqual(
      new Set([CHOSEN, 'Lalezar', 'Noto Nastaliq Urdu']),
    );
  });

  it('carries every stand-in the mixed text can reach', () => {
    expect(familiesFor('hello שלום مرحبا')).toEqual(
      new Set([CHOSEN, 'Heebo Variable', 'Lalezar', 'Noto Nastaliq Urdu']),
    );
  });
});

describe("families that are nobody's stand-in", () => {
  it('keeps a family the template CSS names outright', () => {
    const families = collector.collect({
      sheet,
      document: documentSaying('latin only'),
      inlineStyles: { '--tscaps-font-family': resolver.resolve(CHOSEN) },
      sheetCss: `.word { font-family: 'Bungee'; }`,
      elementStyles: ElementStyles.empty(),
    });
    expect(families).toEqual(new Set([CHOSEN, 'Bungee']));
  });
});

// A template can hand a second face to part of the caption through a
// `font`-typed control. The value reaches the render as a custom
// property, and the CSS names the same face only as that property's
// fallback — which this collector skips on purpose. So the control is
// the one source that can put the face on the list.
describe('a face a template offers through a font control', () => {
  const sheetWithFontControl = {
    id: 'main',
    template: { styleControls: [{ id: 'behind-font-family', type: 'font', default: 'Anton' }] },
  } as unknown as Sheet;

  function familiesWith(inlineStyles: Record<string, string>): Set<string> {
    return collector.collect({
      sheet: sheetWithFontControl,
      document: documentSaying('latin only'),
      inlineStyles: { '--tscaps-font-family': resolver.resolve(CHOSEN), ...inlineStyles },
      sheetCss: `.segment { font-family: var(--tscaps-behind-font-family, 'Anton'); }`,
      elementStyles: ElementStyles.empty(),
    });
  }

  it('carries the face the control resolves to', () => {
    expect(familiesWith({ '--tscaps-behind-font-family': resolver.resolve('Anton') }))
      .toEqual(new Set([CHOSEN, 'Anton']));
  });

  // Deliberate, and the reason the property has to be published: a face
  // named only as a `var()` fallback is one the export ships no
  // `@font-face` for while the CSS still asks for it.
  it('does not carry a face named only as a var fallback', () => {
    expect(familiesWith({})).toEqual(new Set([CHOSEN]));
  });
});
