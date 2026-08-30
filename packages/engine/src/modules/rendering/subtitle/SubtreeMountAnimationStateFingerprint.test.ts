import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * Whether two timestamps may share one rendered tile, asked of a
 * browser.
 *
 * The subject answers by mounting the subtree a tile is built from and
 * reading back what the browser says is running on it, so the only
 * thing that can check it is a CSS engine. The failure this locks is
 * silent and one-way: two timestamps wrongly called equal make the
 * planner reuse a tile across a frame that moved, and the animation
 * exports as a still image while the preview plays it.
 *
 * What is under test is the reading, not the building — the subtree
 * arrives as the HTML a stand-in renderer hands over, which is the
 * same shape the real one produces.
 */

const FIXTURE_ID = 'virtual:animation-phase-probe-fixture';
const FIXTURE_SOURCE = `
  export { SubtreeMountAnimationStateFingerprint } from '@modules/rendering/subtitle/SubtreeMountAnimationStateFingerprint';
  export { SubtreeAnimationSupport } from '@modules/rendering/subtitle/SubtreeAnimationSupport';
`;

const SCOPE_CLASS = 'tscaps-render-probe';
const VIEWPORT_WIDTH = 720;
const VIEWPORT_HEIGHT = 1280;

/** A caption whose words narrate a fifth of a second apart, starting at the segment. */
const WORD_STRIDE_S = 0.2;
const WORD_COUNT = 3;

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
    name: 'animation-phase-probe-fixture',
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
  const output = Array.isArray(result) ? result[0]!.output : 'output' in result ? result.output : [];
  return (output as ReadonlyArray<{ type: string; code?: string }>)
    .filter((chunk) => chunk.type === 'chunk')
    .map((chunk) => chunk.code ?? '')
    .join('\n');
}

async function openPage(css: string): Promise<Page> {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  await page.addScriptTag({ content: bundle });
  await page.evaluate(
    ({ styleCss, scopeClass }) => {
      const frozen = document.createElement('style');
      frozen.textContent =
        '*, *::before, *::after { animation-play-state: paused !important; animation-fill-mode: both !important; }';
      document.head.appendChild(frozen);
      const sheet = document.createElement('style');
      sheet.textContent = styleCss;
      document.head.appendChild(sheet);
      const container = document.createElement('div');
      container.className = scopeClass;
      container.style.cssText = 'position:fixed;left:-99999px;visibility:hidden;';
      container.id = 'probe-container';
      document.body.appendChild(container);
    },
    { styleCss: css, scopeClass: SCOPE_CLASS },
  );
  return page;
}

/**
 * The probe's answer at each timestamp: the phase key, or `'MOVING'`
 * where it refuses to let any two timestamps share a tile.
 */
async function keysAt(page: Page, timestamps: ReadonlyArray<number>): Promise<string[]> {
  return page.evaluate(
    async ({ times, scopeClass, width, height, stride, wordCount }) => {
      const { SubtreeMountAnimationStateFingerprint, SubtreeAnimationSupport } = (
        window as unknown as {
          fixture: {
            SubtreeMountAnimationStateFingerprint: new (
              renderer: { buildWrapperHtml: (...args: never[]) => Promise<{ html: string; defs: string }> },
              support: { isAvailable: () => boolean },
              width: number,
              height: number,
            ) => { at: (style: unknown, seg: unknown, t: number, index: number, fingerprint: string) => Promise<string | null> };
            SubtreeAnimationSupport: new () => { isAvailable: () => boolean };
          };
        }
      ).fixture;

      const statesAt = (t: number) => {
        const states = [];
        for (let i = 0; i < wordCount; i++) {
          const start = i * stride;
          states.push(t < start ? 'word-not-narrated-yet'
            : t < start + stride ? 'word-being-narrated' : 'word-already-narrated');
        }
        return states;
      };

      const wordsAt = (t: number) => {
        const spans = [];
        const states = statesAt(t);
        for (let i = 0; i < wordCount; i++) {
          const start = i * stride;
          const state = states[i];
          spans.push(
            `<span class="word ${state}" style="--on-word-being-narrated-starts:${(start - t).toFixed(3)}s;`
            + `--word-being-narrated-duration:${stride.toFixed(3)}s;--letter-index:${i};--letter-count:${wordCount}">w${i}</span>`,
          );
        }
        return spans.join(' ');
      };

      const renderer = {
        buildWrapperHtml: (...args: never[]) => {
          const t = args[2] as unknown as number;
          return Promise.resolve({
            html: `<div class="${scopeClass}"><div class="segment" style="--on-segment-starts:${(-t).toFixed(3)}s;`
              + `--segment-duration:2.000s"><div class="line">${wordsAt(t)}</div></div></div>`,
            defs: '',
          });
        },
      };

      const probe = new SubtreeMountAnimationStateFingerprint(renderer, new SubtreeAnimationSupport(), width, height);
      const style = {
        probeContainer: document.getElementById('probe-container')!,
        rendering: { videoFrame: { required: false } },
      };

      const answers: string[] = [];
      for (const t of times) {
        answers.push((await probe.at(style, {}, t, 0, statesAt(t).join(','))) ?? 'MOVING');
      }
      return answers;
    },
    {
      times: [...timestamps],
      scopeClass: SCOPE_CLASS,
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      stride: WORD_STRIDE_S,
      wordCount: WORD_COUNT,
    },
  );
}

/**
 * The probe's answers for subtrees whose two words carry the delays
 * given, one pair per answer. Lets a test place the same rule at
 * different positions without going through narration, which can only
 * ever move the delays one way.
 */
async function keysForDelayPairs(page: Page, pairs: ReadonlyArray<readonly [number, number]>): Promise<string[]> {
  return page.evaluate(
    async ({ delayPairs, scopeClass, width, height }) => {
      const { SubtreeMountAnimationStateFingerprint, SubtreeAnimationSupport } = (
        window as unknown as {
          fixture: {
            SubtreeMountAnimationStateFingerprint: new (
              renderer: { buildWrapperHtml: (...args: never[]) => Promise<{ html: string; defs: string }> },
              support: { isAvailable: () => boolean },
              width: number,
              height: number,
            ) => { at: (style: unknown, seg: unknown, t: number, index: number, fingerprint: string) => Promise<string | null> };
            SubtreeAnimationSupport: new () => { isAvailable: () => boolean };
          };
        }
      ).fixture;

      const style = {
        probeContainer: document.getElementById('probe-container')!,
        rendering: { videoFrame: { required: false } },
      };

      const answers: string[] = [];
      for (const [first, second] of delayPairs) {
        const renderer = {
          buildWrapperHtml: () => Promise.resolve({
            html: `<div class="${scopeClass}"><div class="segment"><div class="line">`
              + `<span class="word" style="--on-word-being-narrated-starts:${first}s">a</span>`
              + `<span class="word" style="--on-word-being-narrated-starts:${second}s">b</span>`
              + `</div></div></div>`,
            defs: '',
          }),
        };
        const probe = new SubtreeMountAnimationStateFingerprint(renderer, new SubtreeAnimationSupport(), width, height);
        answers.push((await probe.at(style, {}, 0, 0, `${first}/${second}`)) ?? 'MOVING');
      }
      return answers;
    },
    { delayPairs: pairs.map((pair) => [...pair]), scopeClass: SCOPE_CLASS, width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
  );
}

/**
 * Two series over the same timestamps: one where every call shares a
 * fingerprint, so readings may be carried across playheads, and one
 * where each call gets a fingerprint of its own, so every timestamp is
 * mounted. The second is the ground truth the first has to match.
 */
async function carriedAgainstMountedSeries(
  page: Page,
  timestamps: ReadonlyArray<number>,
  clockScale: number,
): Promise<{ carried: string[]; mounted: string[] }> {
  return page.evaluate(
    async ({ times, scale, scopeClass, width, height }) => {
      const { SubtreeMountAnimationStateFingerprint, SubtreeAnimationSupport } = (
        window as unknown as {
          fixture: {
            SubtreeMountAnimationStateFingerprint: new (
              renderer: { buildWrapperHtml: (...args: never[]) => Promise<{ html: string; defs: string }> },
              support: { isAvailable: () => boolean },
              width: number,
              height: number,
            ) => { at: (style: unknown, seg: unknown, t: number, index: number, fingerprint: string) => Promise<string | null> };
            SubtreeAnimationSupport: new () => { isAvailable: () => boolean };
          };
        }
      ).fixture;

      const WORD_STARTS_AT = 0.5;
      // The clock the renderer writes is faithful; the stylesheet is
      // what scales it, which is the shape a `calc()` on a clock takes.
      const renderer = {
        buildWrapperHtml: (...args: never[]) => {
          const t = args[2] as unknown as number;
          const clock = ((WORD_STARTS_AT - t) * scale).toFixed(3);
          return Promise.resolve({
            html: `<div class="${scopeClass}"><div class="segment"><div class="line">`
              + `<span class="word" style="--on-word-being-narrated-starts:${clock}s">w</span>`
              + `</div></div></div>`,
            defs: '',
          });
        },
      };

      const style = {
        probeContainer: document.getElementById('probe-container')!,
        rendering: { videoFrame: { required: false } },
      };
      const carrying = new SubtreeMountAnimationStateFingerprint(renderer, new SubtreeAnimationSupport(), width, height);
      const mounting = new SubtreeMountAnimationStateFingerprint(renderer, new SubtreeAnimationSupport(), width, height);

      const carried: string[] = [];
      const mounted: string[] = [];
      for (const t of times) {
        carried.push((await carrying.at(style, {}, t, 0, 'one-picture')) ?? 'MOVING');
        mounted.push((await mounting.at(style, {}, t, 0, `fresh-${t}`)) ?? 'MOVING');
      }
      return { carried, mounted };
    },
    { times: [...timestamps], scale: clockScale, scopeClass: SCOPE_CLASS, width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
  );
}

describe('carrying a reading across playheads', () => {
  const css = `
    .word { display: inline-block;
      animation: reveal 0.05s var(--on-word-being-narrated-starts, 0s) linear both }
    @keyframes reveal { from { opacity: 0 } to { opacity: 1 } }
  `;
  const acrossTheBoundary = Array.from({ length: 40 }, (_, i) => 0.2 + i * 0.02);

  it('answers exactly as mounting every timestamp would, for a clock followed faithfully', async () => {
    const page = await openPage(css);
    const { carried, mounted } = await carriedAgainstMountedSeries(page, acrossTheBoundary, 1);
    expect(carried).toEqual(mounted);
    await page.close();
  });

  // A clock drifting by a few percent stays inside the tolerance two
  // close readings are compared with, so nothing catches it up front.
  // What keeps it honest is refusing to carry a reading farther than
  // the playhead sits from the nearest boundary.
  it('answers the same for a clock that drifts too little to be caught by comparing two readings', async () => {
    const page = await openPage(css);
    const closelySpaced = Array.from({ length: 80 }, (_, i) => 0.1 + i * 0.01);
    const { carried, mounted } = await carriedAgainstMountedSeries(page, closelySpaced, 1.09);
    expect(carried).toEqual(mounted);
    await page.close();
  });

  // A stylesheet multiplying a clock moves its boundaries faster than
  // the playhead, so anything carried forward lands in the wrong phase.
  it('answers the same for a clock the stylesheet scales, having refused to carry anything', async () => {
    const page = await openPage(`
      .word { display: inline-block;
        animation: reveal 0.05s calc(var(--on-word-being-narrated-starts, 0s) * 3) linear both }
      @keyframes reveal { from { opacity: 0 } to { opacity: 1 } }
    `);
    const { carried, mounted } = await carriedAgainstMountedSeries(page, acrossTheBoundary, 1);
    expect(carried).toEqual(mounted);
    await page.close();
  });
});

describe('two elements running the same rule, in opposite phases', () => {
  // Both subtrees hold one settled effect of each phase, so the set of
  // phases alone cannot tell them apart — only which element is in which.
  it('is told apart by which element holds which phase', async () => {
    const page = await openPage(`
      .word { display: inline-block;
        animation: reveal 0.05s var(--on-word-being-narrated-starts, 0s) linear both }
      @keyframes reveal { from { opacity: 0 } to { opacity: 1 } }
    `);
    const [firstAhead, secondAhead] = await keysForDelayPairs(page, [[-1, 1], [1, -1]]);
    expect(firstAhead).not.toBe('MOVING');
    expect(secondAhead).not.toBe('MOVING');
    expect(firstAhead).not.toBe(secondAhead);
    await page.close();
  });
});

describe('a caption with no animation at all', () => {
  it('gives every timestamp the same answer, so all of them share one tile', async () => {
    const page = await openPage('.segment { color: #fff } .word { display: inline-block }');
    const keys = await keysAt(page, [0.05, 0.5, 1.2]);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).not.toBe('MOVING');
    await page.close();
  });
});

describe('a short entrance on the segment', () => {
  const css = `
    .segment { animation: entrance 0.18s var(--on-segment-starts, 0s) ease both; color: #fff }
    @keyframes entrance { from { opacity: 0 } to { opacity: 1 } }
    .word { display: inline-block }
  `;

  it('refuses to share a tile while the entrance is mid-flight', async () => {
    const page = await openPage(css);
    expect(await keysAt(page, [0.09])).toEqual(['MOVING']);
    await page.close();
  });

  it('lets the still stretch after it share one tile', async () => {
    const page = await openPage(css);
    const keys = await keysAt(page, [0.9, 1.1]);
    expect(keys[0]).not.toBe('MOVING');
    expect(keys[0]).toBe(keys[1]);
    await page.close();
  });

  it('tells the frames before it from the frames after it', async () => {
    const page = await openPage(`${css} .segment { animation-delay: calc(var(--on-segment-starts, 0s) + 1s) }`);
    const [beforeIt, afterIt] = await keysAt(page, [0.5, 1.5]);
    expect(beforeIt).not.toBe('MOVING');
    expect(afterIt).not.toBe('MOVING');
    expect(beforeIt).not.toBe(afterIt);
    await page.close();
  });
});

describe('an animation that repeats forever', () => {
  it('never lets two timestamps share a tile, however still the caption looks', async () => {
    const page = await openPage(`
      .segment { animation: bob 1.6s var(--on-segment-starts, 0s) linear infinite both; color: #fff }
      @keyframes bob { to { translate: 0 4px } }
      .word { display: inline-block }
    `);
    expect(await keysAt(page, [0.5, 1.0, 1.5])).toEqual(['MOVING', 'MOVING', 'MOVING']);
    await page.close();
  });
});

describe('an animation that fires instantly, holding a value on each side', () => {
  // Never mid-run at any playhead, so "is anything running?" cannot see
  // it — and the picture on either side of it differs.
  it('tells the frames on either side apart', async () => {
    const page = await openPage(`
      .word { display: inline-block;
        animation: appear 0s var(--on-word-being-narrated-starts, 0s) step-start both }
      @keyframes appear { from { opacity: 0 } to { opacity: 1 } }
    `);
    const [beforeIt, afterIt] = await keysAt(page, [0.15, 0.25]);
    expect(beforeIt).not.toBe('MOVING');
    expect(afterIt).not.toBe('MOVING');
    expect(beforeIt).not.toBe(afterIt);
    await page.close();
  });
});

describe('an animation living on a pseudo-element of a word', () => {
  it('is seen, even though nothing enumerates pseudo-elements', async () => {
    const page = await openPage(`
      .word { position: relative; display: inline-block }
      .word::before { content: ""; position: absolute; inset: 0;
        animation: pill 0.16s var(--on-word-being-narrated-starts, 0s) ease both }
      @keyframes pill { from { scale: 0 1 } to { scale: 1 1 } }
    `);
    expect(await keysAt(page, [0.05])).toEqual(['MOVING']);
    await page.close();
  });
});

describe('a per-letter delay built with calc() out of several variables', () => {
  const css = `
    .word { display: inline-block;
      animation: reveal 0.05s
        calc(var(--on-word-being-narrated-starts, 0s)
          + var(--word-being-narrated-duration, 0s) * var(--letter-index, 0) / var(--letter-count, 1))
        linear both }
    @keyframes reveal { from { opacity: 0 } to { opacity: 1 } }
  `;

  it('refuses a shared tile while one of the staggered runs is mid-flight', async () => {
    const page = await openPage(css);
    expect(await keysAt(page, [0.01])).toEqual(['MOVING']);
    await page.close();
  });

  // At 0.15 s the first word has settled and the other two have not
  // started; by 0.9 s all three have. Both are still, and they differ.
  it('tells two settled timestamps apart when a later word arrived between them', async () => {
    const page = await openPage(css);
    const [earlier, later] = await keysAt(page, [0.15, 0.9]);
    expect(earlier).not.toBe('MOVING');
    expect(later).not.toBe('MOVING');
    expect(earlier).not.toBe(later);
    await page.close();
  });
});
