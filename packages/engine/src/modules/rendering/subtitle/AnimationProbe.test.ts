import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin, type Rollup } from 'vite';

/**
 * What the export's tile cache can see, asked of a browser.
 *
 * The probe answers by mounting a throw-away chain and reading back
 * what the stylesheet resolved on it, so the only thing that can say
 * whether that chain stands for the node it describes is a CSS engine.
 * The failure this locks is silent and one-way: a chain that resolves
 * to no animation, or to a shorter one, makes the planner reuse a tile
 * across a frame that moved, and the animation exports as a still
 * image while the preview plays it.
 *
 * The subject has to run where `getComputedStyle` does, so the module
 * is bundled for the page rather than imported here.
 */

const FIXTURE_ID = 'virtual:animation-probe-fixture';
const FIXTURE_SOURCE = `
  export { AnimationProbe } from '@modules/rendering/subtitle/AnimationProbe';
  export { Segment } from '@modules/document/Segment';
  export { Line } from '@modules/document/Line';
  export { Word } from '@modules/document/Word';
  export { Decoration } from '@modules/document/Decoration';
  export { TimeFragment } from '@modules/document/TimeFragment';
`;

const SEGMENT_ID = 'seg1';
const WORD_ID = 'w1';
const DECORATION_ID = 'w1:d';
const WORD_START = 1;
const WORD_END = 2;
const ENTRANCE_DURATION_S = 0.3;

/** What the stylesheet addresses, and the animation it gives that one element. */
interface AddressedAnimation {
  readonly elementId: string;
  readonly clockVariable: string;
  readonly selector?: string;
}

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
    name: 'animation-probe-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixtureModulePlugin()],
    resolve: { alias: { '@modules': resolve(import.meta.dirname, '../..') } },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: FIXTURE_ID,
        // An app build tree-shakes an entry's exports away, and this
        // entry is nothing but exports.
        preserveEntrySignatures: 'strict',
        output: { format: 'iife', name: 'fixture', entryFileNames: 'fixture.js' },
      },
    },
  });
  const built = result as Rollup.RollupOutput;
  return built.output[0]!.code;
}

/**
 * A stylesheet giving one addressed element an entrance, over a
 * template that either animates its words on a shorter window or does
 * not animate at all.
 */
function stylesheet(animation: AddressedAnimation, templateCss: string): string {
  const target = animation.selector
    ? `[data-tscaps-el="${animation.elementId}"] ${animation.selector}`
    : `[data-tscaps-el="${animation.elementId}"]`;
  return `
    @keyframes element-entrance { from { opacity: 0 } to { opacity: 1 } }
    ${templateCss}
    ${target} { animation: element-entrance ${ENTRANCE_DURATION_S}s var(${animation.clockVariable}) both }`;
}

/** A template animating every word over a window far shorter than the entrance's. */
function templateAnimatingWords(): string {
  return `
    @keyframes template-fade { from { opacity: 0 } to { opacity: 1 } }
    .word { animation: template-fade 0.05s var(--on-word-being-narrated-starts) both }`;
}

async function probedAt(animation: AddressedAnimation, templateCss: string, t: number): Promise<boolean> {
  const page = await browser.newPage();
  try {
    await page.setContent(`<style>${stylesheet(animation, templateCss)}</style><div id="probe-host"></div>`);
    await page.addScriptTag({ content: bundle });
    return await askTheProbe(page, animation.elementId, t);
  } finally {
    await page.close();
  }
}

function askTheProbe(page: Page, addressedId: string, t: number): Promise<boolean> {
  return page.evaluate(({ addressedId: id, at, wordId, decorationId, segmentId, wordStart, wordEnd }) => {
    const { AnimationProbe, Segment, Line, Word, Decoration, TimeFragment } =
      (window as unknown as { fixture: Record<string, new (...args: never[]) => unknown> }).fixture as never as {
        AnimationProbe: new () => { isItemAnimating: (style: unknown, seg: unknown, t: number) => boolean };
        Segment: new (props: unknown) => unknown;
        Line: new (props: unknown) => unknown;
        Word: new (props: unknown) => unknown;
        Decoration: new (props: unknown) => unknown;
        TimeFragment: new (start: number, end: number) => unknown;
      };
    const decoration = new Decoration({ id: decorationId, glyph: '*' });
    const word = new Word({ text: 'a', time: new TimeFragment(wordStart, wordEnd), id: wordId, decoration });
    const segment = new Segment({ lines: [new Line({ words: [word], id: 'l1' })], id: segmentId });
    const style = {
      kind: 'main',
      rendering: { splitWordsIntoLetters: false, videoFrame: { required: false } },
      filters: { definitions: { isEmpty: () => true } },
      addressableElementIds: new Set([id]),
      probeContainer: document.getElementById('probe-host')!,
    };
    return new AnimationProbe().isItemAnimating(style, segment, at);
  }, {
    addressedId,
    at: t,
    wordId: WORD_ID,
    decorationId: DECORATION_ID,
    segmentId: SEGMENT_ID,
    wordStart: WORD_START,
    wordEnd: WORD_END,
  });
}

const WORD_CLOCK = '--on-word-being-narrated-starts';
const SEGMENT_CLOCK = '--on-segment-starts';
const NO_TEMPLATE_ANIMATION = '.word { color: white }';

describe('an animation only the addressed element carries', () => {
  it('is seen on the word that carries it', async () => {
    const animation = { elementId: WORD_ID, clockVariable: WORD_CLOCK };
    expect(await probedAt(animation, NO_TEMPLATE_ANIMATION, WORD_START + 0.1)).toBe(true);
  }, 60_000);

  it('is seen on the caption that carries it', async () => {
    const animation = { elementId: SEGMENT_ID, clockVariable: SEGMENT_CLOCK };
    expect(await probedAt(animation, NO_TEMPLATE_ANIMATION, WORD_START + 0.1)).toBe(true);
  }, 60_000);

  it('is seen on the glyph that carries it', async () => {
    const animation = { elementId: DECORATION_ID, clockVariable: WORD_CLOCK };
    expect(await probedAt(animation, NO_TEMPLATE_ANIMATION, WORD_START + 0.1)).toBe(true);
  }, 60_000);

  it('is seen on every word of the caption that asked for it', async () => {
    const animation = { elementId: SEGMENT_ID, clockVariable: WORD_CLOCK, selector: ':where(.word)' };
    expect(await probedAt(animation, NO_TEMPLATE_ANIMATION, WORD_START + 0.1)).toBe(true);
  }, 60_000);

  // The template's own animation is over by now, so a chain reading it
  // instead of the element's reports a frame that no longer moves.
  it('outlasts the shorter one the template gives the same word', async () => {
    const animation = { elementId: WORD_ID, clockVariable: WORD_CLOCK };
    expect(await probedAt(animation, templateAnimatingWords(), WORD_START + 0.2)).toBe(true);
  }, 60_000);

  it('stops being seen once it is over', async () => {
    const animation = { elementId: WORD_ID, clockVariable: WORD_CLOCK };
    expect(await probedAt(animation, NO_TEMPLATE_ANIMATION, WORD_START + ENTRANCE_DURATION_S + 0.5)).toBe(false);
  }, 60_000);
});
