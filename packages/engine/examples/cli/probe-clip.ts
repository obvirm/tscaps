import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Probe: background-clip:text gradient shapes (seconds, no pipeline).
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
    page.on('console', (msg) => {
      if (msg.text().includes('caseProbe')) console.log(`[page] ${msg.text()}`);
    });
    await page.goto(`${url}cli/takumi-runner.html`);
    await page.waitForFunction(() => typeof window.clipTextProbe === 'function', null, { timeout: 180000 });
    const first = process.argv[2] ?? '';
    const out = await page.evaluate((f) => window.clipTextProbe(f), first);
    const bisect = await page.evaluate(() => window.bisectProbe());
    console.log('bisect (png bytes):', JSON.stringify(bisect));
    const bungee = await page.evaluate(() => window.caseProbe());
    for (const [key, data] of Object.entries(bungee)) {
      writeFileSync(`compare/case-${key}.png`, Buffer.from(data));
    }
    console.log('case done');
    mkdirSync('compare', { recursive: true });
    for (const [key, data] of Object.entries(out)) {
      writeFileSync(`compare/clip-${key}.png`, Buffer.from(data));
      console.log(`compare/clip-${key}.png: ${data.length} bytes`);
    }
    console.log('CLIP PROBE OK');
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}
