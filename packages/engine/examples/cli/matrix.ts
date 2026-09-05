import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Template compatibility matrix: every gallery template through Takumi and
// through Chromium at the same instant, scored automatically.
// Usage: pnpm exec tsx cli/matrix.ts [only-this-template]
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(HERE, '..');
const STAMPS = [1.5, 4.2];

interface CaseResult {
  name: string;
  t: number;
  takumi: { png: number[] } | { error: string };
  browser: {
    segments: ReadonlyArray<{ x: number; y: number; w: number; h: number }>;
    words: ReadonlyArray<{ rect: { x: number; y: number; w: number; h: number }; visibility: string }>;
    animationCount: number;
  } | { error: string };
  font: { family: string; loaded: boolean; browserLoaded: boolean };
}

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
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(`${url}cli/takumi-runner.html`);
    await page.waitForFunction(() => typeof window.matrixCase === 'function', null, { timeout: 180000 });
    const only = process.argv[2];
    const names = (await page.evaluate(() => window.matrixNames())) as string[];
    const picked = only ? names.filter((n) => n === only) : names;
    if (picked.length === 0) throw new Error(`no templates match ${only ?? ''}`);
    mkdirSync('compare/matrix', { recursive: true });
    const rows: string[] = [];
    for (const name of picked) {
      for (const t of STAMPS) {
        // eslint-disable-next-line no-await-in-loop
        const result = (await page.evaluate(
          ([n, stamp]: [string, number]) => window.matrixCase(n, stamp),
          [name, t] as [string, number],
        )) as unknown as CaseResult;
        // eslint-disable-next-line no-await-in-loop
        rows.push(scoreCase(result));
      }
    }
    console.log('\n| template | t | verdict | detail |');
    console.log('|---|---|---|---|');
    for (const row of rows) console.log(row);
    if (errors.length > 0) console.log(`\npage errors:\n${errors.join('\n')}`);
    console.log('\nMATRIX DONE');
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}

function scoreCase(result: CaseResult): string {
  const { name, t } = result;
  const fontNote = result.font.loaded ? '' : ` font ${result.font.family} NOT loaded;`;
  const browserFontNote = result.font.loaded && !result.font.browserLoaded ? ' browser fell back;' : '';
  if ('error' in result.takumi) {
    return `| ${name} | ${t} | RED | takumi threw: ${trunc(result.takumi.error)};${fontNote} |`;
  }
  const pngPath = `compare/matrix/${name}-t${t}.png`;
  writeFileSync(pngPath, Buffer.from(result.takumi.png));
  // High alpha threshold: soft box-shadows (which getBoundingClientRect
  // excludes on the browser side) must not count as content. What remains
  // is text, chrome, and hard edges on both sides.
  const bbox = alphaBbox(pngPath, 100);
  if (!('segments' in result.browser)) {
    return `| ${name} | ${t} | YELLOW | browser probe threw: ${trunc(result.browser.error)};${fontNote} |`;
  }
  if (!bbox) {
    return `| ${name} | ${t} | RED | takumi PNG empty;${fontNote} |`;
  }
  const seg = result.browser.segments[0];
  if (!seg || seg.w === 0 || seg.h === 0) {
    return `| ${name} | ${t} | YELLOW | browser segment empty;${fontNote} |`;
  }
  const dx = Math.abs(bbox.cx - (seg.x + seg.w / 2));
  const dy = Math.abs(bbox.cy - (seg.y + seg.h / 2));
  const topDrift = Math.abs(bbox.top - seg.y);
  const sizeRatio = Math.max(bbox.w / seg.w, seg.w / bbox.w);
  const hidden = result.browser.words.filter((w) => w.visibility === 'hidden').length;
  const detail = `drift=(${dx.toFixed(0)},${dy.toFixed(0)}) topDrift=${topDrift.toFixed(0)} sizeX=${sizeRatio.toFixed(2)} anims=${result.browser.animationCount} hiddenWords=${hidden};${fontNote}${browserFontNote}`;
  if (dx < 70 && dy < 70 && sizeRatio < 1.8) return `| ${name} | ${t} | GREEN | ${detail} |`;
  return `| ${name} | ${t} | YELLOW | ${detail} |`;
}

function trunc(s: string): string {
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

function alphaBbox(pngPath: string, threshold: number): { cx: number; cy: number; top: number; w: number; h: number } | null {
  const script = [
    'from PIL import Image',
    'import json',
    `im = Image.open(${JSON.stringify(pngPath)}).convert('RGBA')`,
    'px = im.load(); w,h = im.size',
    `xs = [x for x in range(w) if any(px[x,y][3] > ${threshold} for y in range(h))]`,
    `ys = [y for y in range(h) if any(px[x,y][3] > ${threshold} for x in range(w))]`,
    'print(json.dumps(None if not xs or not ys else {"cx": (min(xs)+max(xs))/2, "cy": (min(ys)+max(ys))/2, "top": min(ys), "w": max(xs)-min(xs)+1, "h": max(ys)-min(ys)+1}))',
  ].join('\n');
  const out = execFileSync('python', ['-c', script], { encoding: 'utf8' });
  return JSON.parse(out) as { cx: number; cy: number; top: number; w: number; h: number } | null;
}
