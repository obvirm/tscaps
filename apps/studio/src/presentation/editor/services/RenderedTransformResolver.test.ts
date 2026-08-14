import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from '@playwright/test';
import { RenderedTransformResolver } from '@presentation/editor/services/RenderedTransformResolver';

/**
 * What an element is painted with, asked of the browser that paints it.
 *
 * Half of this class is a promise about strings only a CSS engine
 * produces: which of `transform`, `rotate` and `scale` survive to the
 * computed style, in what form, and what a shorthand like
 * `rotate(30deg) scale(2)` collapses to. Written from the spec it would
 * be a guess, and a wrong guess reads as chrome that quietly stops
 * following what it frames.
 *
 * So Chromium computes the styles and the real class consumes them,
 * with nothing between the two but the walk up the tree.
 */

interface DeclaredStyle {
  readonly transform?: string;
  readonly rotate?: string;
  readonly scale?: string;
}

let browser: Browser;

beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser.close(); });

/**
 * Renders a nested chain of divs carrying `declared` — outermost first —
 * and returns what Chromium resolved for each, outermost first.
 */
async function computedStyles(declared: ReadonlyArray<DeclaredStyle>): Promise<ReadonlyArray<Required<DeclaredStyle>>> {
  const page = await browser.newPage();
  try {
    const open = declared
      .map((style, index) => {
        const css = Object.entries(style).map(([key, value]) => `${key}: ${value}`).join('; ');
        return `<div data-i="${index}" style="${css}">`;
      })
      .join('');
    await page.setContent(`<div id="scope">${open}${'</div>'.repeat(declared.length)}</div>`);
    return await page.evaluate((count) => Array.from({ length: count }, (_, index) => {
      const element = document.querySelector(`[data-i="${index}"]`)!;
      const styles = window.getComputedStyle(element);
      return { transform: styles.transform, rotate: styles.rotate, scale: styles.scale };
    }), declared.length);
  } finally {
    await page.close();
  }
}

/**
 * Feeds computed styles to the real resolver through the smallest node
 * chain it walks: a parent link and a computed style per node. The DOM
 * is the boundary here, and the values crossing it came from a browser.
 *
 * `styles[0]` is the scope's own, so a walk that fails to stop there
 * shows up in the answer; the rest are its descendants, outermost first.
 */
function resolveOver(styles: ReadonlyArray<Required<DeclaredStyle>>) {
  const stylesByNode = new Map<unknown, Required<DeclaredStyle>>();
  const scope = { parentElement: null } as unknown as HTMLElement;
  const [scopeStyle, ...descendants] = styles;
  if (scopeStyle) stylesByNode.set(scope, scopeStyle);
  let node = scope;
  for (const style of descendants) {
    const child = { parentElement: node } as unknown as HTMLElement;
    stylesByNode.set(child, style);
    node = child;
  }
  const original = globalThis.window;
  globalThis.window = {
    getComputedStyle: (element: unknown) => stylesByNode.get(element) ?? { transform: 'none', rotate: 'none', scale: 'none' },
  } as unknown as Window & typeof globalThis;
  try {
    return new RenderedTransformResolver().resolve(node, scope);
  } finally {
    globalThis.window = original;
  }
}

/** Resolves over `declared` beneath a scope that transforms nothing. */
async function resolve(declared: ReadonlyArray<DeclaredStyle>) {
  return resolveOver(await computedStyles([{}, ...declared]));
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

describe('RenderedTransformResolver', () => {
  it('reports the identity for an element nothing transforms', async () => {
    const rendered = await resolve([{}]);
    expect(rendered).toEqual({ rotationDeg: 0, scaleX: 1, scaleY: 1 });
  });

  it('leaves a pure translation alone', async () => {
    // The whole point of the class: a caption mid-`slide-in` is moved,
    // not turned or resized, and its chrome must not be rescaled for it.
    const rendered = await resolve([{ transform: 'translate(40px, 10px)' }]);
    expect(round(rendered.rotationDeg)).toBe(0);
    expect(round(rendered.scaleX)).toBe(1);
    expect(round(rendered.scaleY)).toBe(1);
  });

  it('recovers rotation and scale from one transform shorthand', async () => {
    const rendered = await resolve([{ transform: 'rotate(30deg) scale(2)' }]);
    expect(round(rendered.rotationDeg)).toBe(30);
    expect(round(rendered.scaleX)).toBe(2);
    expect(round(rendered.scaleY)).toBe(2);
  });

  it('reads the standalone rotate and scale properties', async () => {
    const rendered = await resolve([{ rotate: '15deg', scale: '1.5 3' }]);
    expect(round(rendered.rotationDeg)).toBe(15);
    expect(round(rendered.scaleX)).toBe(1.5);
    expect(round(rendered.scaleY)).toBe(3);
  });

  it('takes a single scale value on both axes', async () => {
    const rendered = await resolve([{ scale: '2' }]);
    expect(round(rendered.scaleX)).toBe(2);
    expect(round(rendered.scaleY)).toBe(2);
  });

  it('sums rotation and multiplies scale over ancestors', async () => {
    // A word inside a rotated segment inside a scaled wrapper: the
    // chrome has to frame what all three did to it, not what the word
    // itself declares, which is nothing.
    const rendered = await resolve([
      { transform: 'scale(2)' },
      { rotate: '20deg' },
      { transform: 'rotate(10deg) scale(1.5)' },
      {},
    ]);
    expect(round(rendered.rotationDeg)).toBe(30);
    expect(round(rendered.scaleX)).toBe(3);
    expect(round(rendered.scaleY)).toBe(3);
  });

  it('stops at the scope, whatever the scope itself carries', async () => {
    // Everything is measured against the scaler, so the scaler's own
    // transform is already in the coordinates and counting it would
    // apply it twice.
    const rendered = resolveOver(await computedStyles([{ transform: 'rotate(45deg) scale(4)' }, {}]));
    expect(rendered).toEqual({ rotationDeg: 0, scaleX: 1, scaleY: 1 });
  });
});
