import { describe, expect, it } from 'vitest';
import { BidiJsAnalyzer } from '@modules/bidi/BidiJsAnalyzer';
import { CursiveScriptDetector } from '@modules/bidi/CursiveScriptDetector';
import { WordFragmenter } from '@modules/bidi/WordFragmenter';
import { DataAttribute } from '@modules/document/DataAttribute';
import { Decoration } from '@modules/document/Decoration';
import { Line } from '@modules/document/Line';
import { Segment } from '@modules/document/Segment';
import { TimeFragment } from '@modules/document/TimeFragment';
import { Word } from '@modules/document/Word';
import { InlineStyleEmitter } from '@modules/rendering/styles/InlineStyleEmitter';
import { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';
import { ElementWidths } from '@modules/rendering/subtitle/ElementWidths';
import { SegmentSubtreeHtmlBuilder, type SegmentSubtreeStyleInput } from '@modules/rendering/subtitle/SegmentSubtreeHtmlBuilder';
import { GraphemeWordSplitter } from '@modules/splitting/GraphemeWordSplitter';

const builder = new SegmentSubtreeHtmlBuilder(
  new GraphemeWordSplitter(),
  new WordFragmenter(new BidiJsAnalyzer(), new CursiveScriptDetector()),
);

function styleInput(addressableElementIds: ReadonlySet<string>): SegmentSubtreeStyleInput {
  return {
    scopeClass: 'tscaps-render-test-aaa111',
    baseInlineStyles: {},
    wordOverrides: ElementRenderOverrides.empty(),
    splitWordsIntoLetters: false,
    includeVideoFrameLayer: false,
    extraWrapperStyles: {},
    extraSegmentClasses: [],
    decorationPlacements: new Map(),
    inlineStyleEmitter: new InlineStyleEmitter(new Set()),
    textDirection: 'ltr',
    addressableElementIds,
    elementWidths: ElementWidths.empty(),
  };
}

function word(text: string, id: string, start: number, end: number): Word {
  return new Word({ id, text, time: new TimeFragment(start, end) });
}

function render(seg: Segment, addressableElementIds: ReadonlySet<string>): string {
  return builder.buildSegmentSubtree(styleInput(addressableElementIds), seg, 0.5, new Set(), 0);
}

function segmentOf(words: readonly Word[], id = 'seg-1'): Segment {
  return new Segment({ id, lines: [new Line({ id: 'line-1', words: [...words] })] });
}

describe('SegmentSubtreeHtmlBuilder element ids', () => {
  it('stamps no attribute when the stylesheet addresses nothing', () => {
    const html = render(segmentOf([word('hello', 'w-1', 0, 1)]), new Set());
    expect(html).not.toContain(DataAttribute.ELEMENT_ID);
  });

  it('stamps only the word that was asked for', () => {
    const seg = segmentOf([word('hello', 'w-1', 0, 1), word('there', 'w-2', 1, 2)]);
    const html = render(seg, new Set(['w-1']));
    expect(html).toContain(`${DataAttribute.ELEMENT_ID}="w-1"`);
    expect(html).not.toContain('w-2');
  });

  it('addresses a segment and a line by their own ids', () => {
    const seg = segmentOf([word('hello', 'w-1', 0, 1)]);
    const html = render(seg, new Set(['seg-1', 'line-1']));
    expect(html).toContain(`${DataAttribute.ELEMENT_ID}="seg-1"`);
    expect(html).toContain(`${DataAttribute.ELEMENT_ID}="line-1"`);
  });

  it('addresses a decoration by its own id, not its host word', () => {
    const hosted = new Word({
      id: 'w-1',
      text: 'party',
      time: new TimeFragment(0, 1),
      decoration: new Decoration({ id: 'dec-1', glyph: '🎉' }),
    });
    const html = render(segmentOf([hosted]), new Set(['dec-1']));
    expect(html).toContain(`${DataAttribute.ELEMENT_ID}="dec-1"`);
    expect(html).not.toContain('"w-1"');
  });

  // One token, two embedding levels, two painted elements — and the bidi
  // algorithm places each level separately, so the pieces can land far
  // apart on the line. A rule addressing the word means all of it; stamping
  // one piece would colour half a word.
  it('stamps every painted fragment of a bidi-split word', () => {
    const seg = segmentOf([word('טסקאפס.io', 'w-rtl', 0, 1)]);
    const html = render(seg, new Set(['w-rtl']));
    const occurrences = html.split(`${DataAttribute.ELEMENT_ID}="w-rtl"`).length - 1;
    expect(occurrences).toBe(2);
  });

  it('keeps the id out of the markup of elements it was not asked for', () => {
    const seg = segmentOf([word('hello', 'w-1', 0, 1)]);
    const withId = render(seg, new Set(['w-1']));
    const withoutId = render(seg, new Set());
    expect(withId.length).toBeGreaterThan(withoutId.length);
    expect(withoutId).toBe(withId.replace(` ${DataAttribute.ELEMENT_ID}="w-1"`, ''));
  });
});
