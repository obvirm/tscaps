import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * What the compatibility gate promises for an H.264 + AAC video,
 * asked of a real browser — decodability is the browser's answer,
 * not ours.
 *
 * The second case is the production incident this file locks: Safari
 * before 26 ships WebCodecs without `AudioDecoder`, and the gate used
 * to reject every video with an audio track there even though the
 * pipeline carries AAC by packet copy and decodes it through the Web
 * Audio API. Simulated by deleting the WebCodecs audio pair from the
 * page before running the check.
 *
 * The page is served on `http://localhost` through route
 * interception because WebCodecs only exists in secure contexts —
 * a `setContent` page on an opaque origin has no `VideoDecoder` at
 * all and every case would fail for the wrong reason.
 */

const FIXTURE_ID = 'virtual:video-compatibility-checker-fixture';
const FIXTURE_SOURCE = `
  export { MediaBunnyVideoCompatibilityChecker } from '@core/videos/infrastructure/MediaBunnyVideoCompatibilityChecker';
`;

let browser: Browser;
let bundle: string;
let fixtureBase64: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
  const bytes = await readFile(resolve(import.meta.dirname, '../../_shared/fixtures/avc-aac-1s.mp4'));
  fixtureBase64 = bytes.toString('base64');
}, 120_000);

afterAll(async () => { await browser.close(); });

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'video-compatibility-checker-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixtureModulePlugin()],
    resolve: { alias: { '@core': resolve(import.meta.dirname, '../..') } },
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

async function pageWithChecker(): Promise<Page> {
  const page = await browser.newPage();
  await page.route('**/*', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body></body></html>',
  }));
  await page.goto('http://localhost/compatibility-checker-test');
  await page.addScriptTag({ content: bundle });
  return page;
}

/** Runs `check` on the fixture inside the page; resolves to `'passed'` or the thrown error's name. */
async function runCheck(page: Page, options: { withoutWebCodecsAudio: boolean }): Promise<string> {
  return page.evaluate<string, { base64: string; withoutWebCodecsAudio: boolean }>(
    async ({ base64, withoutWebCodecsAudio }) => {
      if (withoutWebCodecsAudio) {
        delete (window as { AudioDecoder?: unknown }).AudioDecoder;
        delete (window as { AudioEncoder?: unknown }).AudioEncoder;
      }
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const checker = new (window as never as { fixture: { MediaBunnyVideoCompatibilityChecker: new () => { check(source: Blob): Promise<void> } } }).fixture.MediaBunnyVideoCompatibilityChecker();
      try {
        await checker.check(new Blob([bytes], { type: 'video/mp4' }));
        return 'passed';
      } catch (err) {
        return err instanceof Error ? err.name : 'unknown';
      }
    },
    { base64: fixtureBase64, withoutWebCodecsAudio: options.withoutWebCodecsAudio },
  );
}

describe('MediaBunnyVideoCompatibilityChecker', () => {
  it('accepts an H.264 + AAC video on a browser with full WebCodecs', async () => {
    const page = await pageWithChecker();
    try {
      await expect(runCheck(page, { withoutWebCodecsAudio: false })).resolves.toBe('passed');
    } finally {
      await page.close();
    }
  });

  it('accepts an H.264 + AAC video on a browser whose WebCodecs has no audio pair', async () => {
    const page = await pageWithChecker();
    try {
      await expect(runCheck(page, { withoutWebCodecsAudio: true })).resolves.toBe('passed');
    } finally {
      await page.close();
    }
  });
});
