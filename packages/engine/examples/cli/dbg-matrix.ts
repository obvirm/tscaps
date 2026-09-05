import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Debug: dump browser-side rects + computed styles for one matrix case.
// Usage: pnpm exec tsx cli/dbg-matrix.ts <template> <t>
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(HERE, '..');
const name = process.argv[2] ?? 'tala';
const t = Number(process.argv[3] ?? '1.5');

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
    const context = await browser.newContext({ viewport: { width: 720, height: 1280 } });
    const page = await context.newPage();
    await page.goto(`${url}cli/takumi-runner.html`);
    await page.waitForFunction(() => typeof window.matrixCase === 'function', null, { timeout: 180000 });
    const dump = await page.evaluate(async ([n, stamp]: [string, number]) => {
      const res = await window.matrixCase(n, stamp, true);
      if (!('segments' in res.browser)) return { browser: res.browser };
      const probe = document.getElementById('matrix-probe');
      const seg = probe?.querySelector('.segment') as HTMLElement | null;
      const out: Record<string, unknown> = { browser: res.browser };
      if (seg) {
        const cs = getComputedStyle(seg);
        out['segment'] = {
          rect: seg.getBoundingClientRect().toJSON(),
          fontSize: cs.fontSize,
          fontFamily: cs.fontFamily.slice(0, 60),
          display: cs.display,
          background: cs.backgroundColor,
        };
        const words = [...probe!.querySelectorAll('.word')].slice(0, 3).map((el) => {
          const h = el as HTMLElement;
          const c = getComputedStyle(h);
          return { text: h.textContent, rect: h.getBoundingClientRect().toJSON(), fontSize: c.fontSize };
        });
        out['words'] = words;
      }
      return out;
    }, [name, t] as [string, number]);
    console.log(JSON.stringify(dump, null, 1).slice(0, 2000));
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}
