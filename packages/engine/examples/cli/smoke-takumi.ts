import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Smoke test: page loads, takumi-js/wasm imports, no full pipeline run.
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
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(`${url}cli/takumi-runner.html`);
    await page.waitForFunction(() => typeof window.renderE2E === 'function', null, { timeout: 120000 });
    const takumiOk = await page.evaluate(() => window.takumiProbe());
    console.log(`renderE2E exposed, takumi smoke PNG bytes: ${takumiOk}`);
    if (errors.length > 0) throw new Error(`page errors:\n${errors.join('\n')}`);
    console.log('SMOKE OK');
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}
