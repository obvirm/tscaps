import path from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Probe: Komika font application + outline fallbacks (seconds, no pipeline).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(HERE, '..');

const server = await createServer({
  root: PACKAGE_ROOT,
  configFile: path.join(PACKAGE_ROOT, 'vite.config.ts'),
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
try {
  const url = server.resolvedUrls?.local?.[0];
  if (!url) throw new Error('no local URL');
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext()).newPage();
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(`${url}cli/takumi-runner.html`);
    await page.waitForFunction(() => typeof window.fontOutlineProbe === 'function', null, { timeout: 120000 });
    const fontBytes = [...readFileSync('E:/project/tscaps/apps/studio/src/styles/fonts/komika-axis.woff2')];
    console.log(`komika bytes: ${fontBytes.length}`);
    // Loki lines FIRST in the fresh page: noFont here is a true fallback
    // (later renders share the registered Komika globally).
    const loki = await page.evaluate(
      (arg: [number[], string[]]) => window.lokiTextProbe(arg[0], arg[1]),
      [fontBytes, ['The jump', 'bucket was in']] as [number[], string[]],
    );
    for (const [key, data] of Object.entries(loki)) {
      writeFileSync(`compare/loki2-${key}.png`, Buffer.from(data!));
      console.log(`compare/loki2-${key}.png: ${data!.length} bytes`);
    }
    const order = await page.evaluate((bytes) => window.fontFirstProbe(bytes), fontBytes);
    for (const [key, data] of Object.entries(order)) {
      writeFileSync(`compare/order-${key}.png`, Buffer.from(data));
    }
    const variants = await page.evaluate((bytes) => window.fontOutlineProbe(bytes), fontBytes);
    mkdirSync('compare', { recursive: true });
    for (const [key, data] of Object.entries(variants)) {
      writeFileSync(`compare/font-${key}.png`, Buffer.from(data));
      console.log(`compare/font-${key}.png: ${data.length} bytes`);
    }
    const iso = await page.evaluate((bytes) => window.cssIsolateProbe(bytes), fontBytes);
    for (const [key, data] of Object.entries(iso)) {
      writeFileSync(`compare/iso2-${key}.png`, Buffer.from(data));
    }
    console.log('isolate done');
    const outlines = await page.evaluate((bytes) => window.outlineVariantsProbe(bytes), fontBytes);
    for (const [key, data] of Object.entries(outlines)) {
      writeFileSync(`compare/outline-${key}.png`, Buffer.from(data));
      console.log(`compare/outline-${key}.png: ${data.length} bytes`);
    }
    const layered = await page.evaluate((bytes) => window.layeredProbe(bytes), fontBytes);
    writeFileSync('compare/layered.png', Buffer.from(layered));
    console.log(`compare/layered.png: ${layered.length} bytes`);
    if (errors.length > 0) throw new Error(`page errors:\n${errors.join('\n')}`);
    console.log('FONT PROBE OK');
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}
