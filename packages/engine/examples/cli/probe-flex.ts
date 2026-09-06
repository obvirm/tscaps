import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Probe: flex caption shrink-wrap variants (seconds, no pipeline).
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
    page.on('pageerror', (err) => console.log('[page error]', err.message));
    await page.goto(`${url}cli/takumi-runner.html`);
    await page.waitForFunction(() => typeof window.flexProbe === 'function', null, { timeout: 180000 });
    const out = await page.evaluate(() => window.flexProbe());
    mkdirSync('compare', { recursive: true });
    for (const [key, data] of Object.entries(out)) {
      writeFileSync(`compare/flex-${key}.png`, Buffer.from(data));
      console.log(`compare/flex-${key}.png: ${data.length} bytes`);
    }
    const lena = await page.evaluate(() => window.lenaProbe());
    for (const [key, data] of Object.entries(lena)) {
      writeFileSync(`compare/lena-${key}.png`, Buffer.from(data));
      console.log(`compare/lena-${key}.png: ${data.length} bytes`);
    }
    console.log('FLEX PROBE OK');
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}
