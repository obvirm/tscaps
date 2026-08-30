import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * What a line will be worth on screen, asked of the browser that will
 * draw it.
 *
 * The splitter decides where a caption breaks from widths it computes
 * analytically, never from a laid-out line, which is what keeps it off
 * the layout path. Nothing in that arithmetic is self-checking: it can
 * count a gap the renderer does not emit, or miss one it does, and the
 * only thing that can tell is a CSS engine laying the same words out.
 *
 * Both failures are silent. Over-counting breaks captions into more
 * lines than they need; under-counting renders them past the edge of
 * the frame. Neither reports anything.
 */

const FIXTURE_ID = 'virtual:measured-width-fixture';
const FIXTURE_SOURCE = `
  export { DomProbeCanvasTextMeasurer } from '@modules/splitting/DomProbeCanvasTextMeasurer';
  export { BalancedPixelWidthLineSplitter } from '@modules/splitting/BalancedPixelWidthLineSplitter';
  export { Segment } from '@modules/document/Segment';
  export { Line } from '@modules/document/Line';
  export { Word } from '@modules/document/Word';
  export { Tag } from '@modules/tags/Tag';
  export { TimeFragment } from '@modules/document/TimeFragment';
`;

const CONTAINER = { width: 720, height: 1280 };

const WORDS = ['this', 'is', 'the', 'kind', 'of', 'thing', 'people', 'say'];
const TAGGED = 'thing';

// Tracking and a per-word margin are both on, because they are what the
// arithmetic has to reconstruct: the browser lays out adjacent elements
// separated by margin alone, and spends letter spacing after every
// character rather than only between them.
const PLAIN_CSS = `
  .segment { font-family: monospace; font-size: 40px; letter-spacing: -0.05em; }
  .word { display: inline-block; margin: 0 0.12em; }
`;
const GROWN_CSS = `${PLAIN_CSS} .emphasis { font-size: 2.4em; }`;

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
}, 120_000);

afterAll(async () => { await browser.close(); });

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'measured-width-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixtureModulePlugin()],
    resolve: { alias: { '@modules': resolve(import.meta.dirname, '..') } },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: FIXTURE_ID,
        preserveEntrySignatures: 'strict',
        output: { format: 'iife', name: 'fixture', entryFileNames: 'fixture.js' },
      },
    },
  });
  const output = Array.isArray(result) ? result[0]!.output : 'output' in result ? result.output : [];
  return (output as ReadonlyArray<{ type: string; code?: string }>)
    .filter((chunk) => chunk.type === 'chunk')
    .map((chunk) => chunk.code ?? '')
    .join('\n');
}

/** A page carrying the bundle, `css`, and a container the caption's units resolve against. */
async function pageUnder(css: string): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewportSize(CONTAINER);
  await page.setContent(
    `<style>${css}</style>`
    + `<div id="stage" style="width:${CONTAINER.width}px;height:${CONTAINER.height}px;container-type:size;"></div>`,
  );
  await page.addScriptTag({ content: bundle });
  await page.evaluate(async () => { await document.fonts.ready; });
  return page;
}

interface Agreement {
  /** What the words occupy once the browser has laid them out, in px. */
  rendered: number;
  /** What the measurer says they occupy, in px. */
  measured: number;
}

/** Lays the words out and asks the measurer for the same line, for comparison. */
async function agreementOn(css: string, tagged: string | null): Promise<Agreement> {
  const page = await pageUnder(css);
  try {
    return await page.evaluate(
      ({ words, tag, container }) => {
        const f = (window as unknown as { fixture: Record<string, never> }).fixture as unknown as {
          DomProbeCanvasTextMeasurer: new (params: unknown) => {
            measure: (text: string, cssClasses: ReadonlyArray<string>) => number;
          };
        };
        const classesOf = (word: string) => (word === tag ? ['emphasis'] : []);

        const stage = document.getElementById('stage')!;
        stage.innerHTML = `<div class="segment"><div class="line" style="white-space:nowrap">${
          words.map((word) => `<span class="word ${classesOf(word).join(' ')}">${word}</span>`).join('')
        }</div></div>`;
        const spans = [...stage.querySelectorAll('.word')];
        const rendered = spans.reduce((total, span) => {
          const style = getComputedStyle(span);
          return total + span.getBoundingClientRect().width
            + parseFloat(style.marginLeft) + parseFloat(style.marginRight);
        }, 0);

        const measurer = new f.DomProbeCanvasTextMeasurer({
          css: document.querySelector('style')!.textContent,
          cssVars: {},
          containerWidth: container.width,
          containerHeight: container.height,
        });
        const measured = words.reduce((total, word) => total + measurer.measure(word, classesOf(word)), 0);
        return { rendered, measured };
      },
      { words: WORDS, tag: tagged, container: CONTAINER },
    );
  } finally {
    await page.close();
  }
}

interface Reading {
  /** Each line as its words joined by a space. */
  lines: string[];
  /**
   * A width that fits the caption's first three words while they are plain
   * and not once one of them is grown — halfway between the two, so it
   * separates them without depending on the platform's font metrics.
   */
  separatingWidth: number;
}

/** Splits the caption under `css` at `maxWidth` and reports where it broke. */
async function readingUnder(css: string, maxWidth: number): Promise<Reading> {
  const page = await pageUnder(css);
  try {
    return await page.evaluate(
      ({ words, tag, container, width }) => {
        const f = (window as unknown as { fixture: Record<string, never> }).fixture as unknown as {
          DomProbeCanvasTextMeasurer: new (params: unknown) => {
            measure: (text: string, cssClasses: ReadonlyArray<string>) => number;
          };
          BalancedPixelWidthLineSplitter: new (config: unknown, measurer: unknown) => {
            split: (segments: ReadonlyArray<unknown>) => Array<{ lines: Array<{ words: Array<{ text: string }> }> }>;
          };
          Segment: new (props: unknown) => unknown;
          Line: new (props: unknown) => unknown;
          Word: new (props: unknown) => unknown;
          Tag: { of: (name: string) => unknown };
          TimeFragment: new (start: number, end: number) => unknown;
        };

        const measurer = new f.DomProbeCanvasTextMeasurer({
          css: document.querySelector('style')!.textContent,
          cssVars: {},
          containerWidth: container.width,
          containerHeight: container.height,
        });
        const built = words.map((text, index) => new f.Word({
          text,
          time: new f.TimeFragment(index, index + 1),
          semanticTags: text === tag ? new Set([f.Tag.of('emphasis')]) : new Set(),
        }));
        const split = new f.BalancedPixelWidthLineSplitter(
          { maxLines: 4, minLines: 1, maxWidth: width },
          measurer,
        ).split([new f.Segment({ lines: [new f.Line({ words: built })] })]);

        const head = words.slice(0, 4);
        const headPlain = head.reduce((sum, word) => sum + measurer.measure(word, []), 0);
        const headGrown = headPlain - measurer.measure(tag, []) + measurer.measure(tag, ['emphasis']);

        return {
          lines: split[0]!.lines.map((line) => line.words.map((word) => word.text).join(' ')),
          separatingWidth: (headPlain + headGrown) / 2,
        };
      },
      { words: WORDS, tag: TAGGED, container: CONTAINER, width: maxWidth },
    );
  } finally {
    await page.close();
  }
}

/** Half a percent, which is subpixel at any caption size and far under one glyph. */
const TOLERANCE = 0.005;

describe('the width the splitter works from', () => {
  it('is the width the browser gives those words', async () => {
    const { rendered, measured } = await agreementOn(PLAIN_CSS, null);

    expect(rendered).toBeGreaterThan(0);
    expect(Math.abs(measured / rendered - 1)).toBeLessThan(TOLERANCE);
  }, 120_000);

  it('is still that width once one of them is styled larger', async () => {
    const { rendered, measured } = await agreementOn(GROWN_CSS, TAGGED);

    expect(Math.abs(measured / rendered - 1)).toBeLessThan(TOLERANCE);
  }, 120_000);
});

describe('a caption holding a word its stylesheet grows', () => {
  // The two stylesheets differ only in a rule the splitter is not looking
  // at directly, and the words, the tags and the width budget are the same
  // in both. So a difference in where the lines fall can only have come
  // through the measurement.
  it('breaks into more lines than the same caption without that rule', async () => {
    const { separatingWidth } = await readingUnder(GROWN_CSS, CONTAINER.width);
    const grown = await readingUnder(GROWN_CSS, separatingWidth);
    const plain = await readingUnder(PLAIN_CSS, separatingWidth);

    expect(grown.lines.length).toBeGreaterThan(plain.lines.length);
    expect(grown.lines.join(' ').split(' ')).toEqual(WORDS);
  }, 120_000);
});
