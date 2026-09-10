import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Temp debug driver: dump full matrixCase browser side for one case,
// or run a lone probe first in a clean room (no earlier render poisons
// the backend font cache).
// Usage: pnpm exec tsx cli/dbg-case.ts <name> <t> [probe-only]
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
    const context = await browser.newContext({ viewport: { width: 720, height: 1280 } });
    const page = await context.newPage();
    page.on('pageerror', (err) => console.log('PAGEERROR', err.message));
    await page.goto(`${url}cli/takumi-runner.html`);
    await page.waitForFunction(() => typeof window.matrixCase === 'function', null, { timeout: 180000 });
    const name = process.argv[2] ?? 'loki';
    const t = Number(process.argv[3] ?? '1.5');
    const probeOnly = process.argv[4] ?? '';
    const probeName = probeOnly === 'nyxprobe' ? 'nyxWidthProbe' : probeOnly === 'bisect' ? 'nodeBisectProbe' : probeOnly === 'font' ? 'fontLoadProbe' : probeOnly === 'split' ? 'splitProbe' : probeOnly === 'fo' ? 'foProbe' : 'nodeBisectProbe';
    if (probeOnly === 'vfont') {
      console.log('videofont:', JSON.stringify(await page.evaluate(`(() => window.videoFontProbe('zara'))()`)));
    }
    if (!probeOnly || process.argv.includes('shot')) {
      const result = (await page.evaluate(([n, stamp]) => window.matrixCase(n as string, stamp as number, true), [name, t] as [string, number])) as unknown as Record<string, unknown>;
      const b = result.browser as { segments: unknown; words: unknown; animationCount: number };
      console.log('segments:', JSON.stringify(b.segments));
      console.log('anims:', b.animationCount);
      console.log('takumi:', 'png' in (result.takumi as object) ? 'png ok' : JSON.stringify(result.takumi));
      if (process.argv.includes('shot')) {
        await page.evaluate(`(() => { document.getElementById('matrix-probe').style.visibility = 'visible'; })()`);
        const el = page.locator('#matrix-probe');
        await el.screenshot({ path: `compare/matrix/probe-${name}-t${t}.png` });
        console.log('probe screenshot saved');
      }
      const dom = await page.evaluate(`(() => {
        const out = [];
        for (const sel of ['.tscaps-takumi-caption', '.tscaps-takumi-hrow', '.segment']) {
          for (const el of document.querySelectorAll(sel)) {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            out.push({ sel, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), sw: el.scrollWidth, display: cs.display, maxWidth: cs.maxWidth });
            if (out.length > 12) break;
          }
          if (out.length > 12) break;
        }
        return out;
      })()`);
      console.log('dom:', JSON.stringify(dom));
    }
    const layers = (await page.evaluate(`(() => window.${probeName}('zara'))()`)) as unknown as Record<string, number[]>;
    const { writeFileSync, mkdirSync } = await import('node:fs');
    mkdirSync('compare/matrix', { recursive: true });
    for (const [key, bytes] of Object.entries(layers)) {
      if (key === 'nodeLen') { console.log('nodeLen:', bytes); continue; }
      writeFileSync(`compare/matrix/dbg-loki-${key}.png`, Buffer.from(bytes));
      console.log(key, bytes.length);
    }
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}
