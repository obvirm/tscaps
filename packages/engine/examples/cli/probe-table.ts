import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Probe: display:table vs block+fit-content (seconds, no pipeline).
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
    await page.waitForFunction(() => typeof window.tableProbe === 'function', null, { timeout: 180000 });
    const out = await page.evaluate(() => window.tableProbe());
    mkdirSync('compare', { recursive: true });
    for (const [key, data] of Object.entries(out)) {
      writeFileSync(`compare/table-${key}.png`, Buffer.from(data));
      console.log(`compare/table-${key}.png: ${data.length} bytes`);
    }
    const child = await page.evaluate(() => window.childProbe());
    for (const [key, data] of Object.entries(child)) {
      writeFileSync(`compare/child-${key}.png`, Buffer.from(data));
      console.log(`compare/child-${key}.png: ${data.length} bytes`);
    }
    const bgvar = await page.evaluate(() => window.bgVarProbe());
    for (const [key, data] of Object.entries(bgvar)) {
      writeFileSync(`compare/bgvar-${key}.png`, Buffer.from(data));
    }
    console.log('bgvar done');
    const lastchild = await page.evaluate(() => window.lastChildProbe());
    for (const [key, data] of Object.entries(lastchild)) {
      writeFileSync(`compare/lastchild-${key}.png`, Buffer.from(data));
    }
    console.log('lastchild done');
    const accent = await page.evaluate(() => window.accentProbe());
    writeFileSync('compare/accent.png', Buffer.from(accent));
    console.log('accent done');
    const ivo = await page.evaluate(() => window.ivoStripProbe());
    for (const [key, data] of Object.entries(ivo)) {
      writeFileSync(`compare/ivoStrip-${key}.png`, Buffer.from(data));
    }
    console.log('ivo strip done');
    console.log('TABLE PROBE OK');
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}
