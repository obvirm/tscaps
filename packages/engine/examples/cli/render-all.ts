import path from 'node:path';
import { createServer as createHttpServer } from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Render every gallery template to its own short video (Takumi path).
// Usage: pnpm exec tsx cli/render-all.ts <clip.mp4> <doc.json> [outDir] [only-this-template]
// Skips templates whose mp4 already exists (resume-safe). videoFrame kinds
// (luca/luna/milo/selene) throw from open() and are logged as SKIP.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(HERE, '..');

const [clipPath, docPath, outDirArg, only, rendererArg] = process.argv.slice(2);
if (!clipPath || !docPath) throw new Error('Usage: render-all.ts <clip.mp4> <doc.json> [outDir] [only] [takumi|browser]');
const OUT_DIR = outDirArg ?? path.join(PACKAGE_ROOT, 'output', 'gallery');
const renderer = rendererArg === 'browser' ? 'browser' : 'takumi';
const suffix = renderer === 'browser' ? '-browser' : '';
const FONTS_DIR = path.join(PACKAGE_ROOT, 'input', 'fonts');

const doc = JSON.parse(await readFile(docPath, 'utf8')) as unknown;

const size = statSync(clipPath).size;
console.log(`Clip: ${clipPath} (${(size / 1048576).toFixed(1)} MB)`);
await mkdir(OUT_DIR, { recursive: true });

const assetServer = createHttpServer((req, res) => {
  const headers = { 'Access-Control-Allow-Origin': '*' };
  if (req.url === '/video.mp4') {
    res.writeHead(200, { ...headers, 'Content-Type': 'video/mp4', 'Content-Length': size });
    createReadStream(clipPath).pipe(res);
    return;
  }
  // Subset files for @font-face embedding (foreignObject raster cannot
  // see document fonts; the pipeline CSS carries them as URLs).
  if (req.url !== undefined && req.url.startsWith('/fonts/')) {
    const file = path.join(FONTS_DIR, path.basename(req.url));
    try {
      const fsize = statSync(file).size;
      res.writeHead(200, { ...headers, 'Content-Type': 'font/woff2', 'Content-Length': fsize });
      createReadStream(file).pipe(res);
      return;
    } catch {
      // Fall through to 404.
    }
  }
  res.writeHead(404).end();
});
await new Promise<void>((resolve) => assetServer.listen(0, '127.0.0.1', resolve));
const address = assetServer.address();
if (address === null || typeof address === 'string') throw new Error('no port');
const videoUrl = `http://127.0.0.1:${address.port}/video.mp4`;

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
    const pageUrl = `${url}cli/takumi-runner.html`;
    const probe = await browser.newPage();
    await probe.goto(pageUrl);
    await probe.waitForFunction(() => typeof window.renderGalleryVideo === 'function', null, { timeout: 180000 });
    const names = (await probe.evaluate(() => window.matrixNames())) as string[];
    await probe.close();
    const picked = only ? names.filter((n) => n === only) : names;
    if (picked.length === 0) throw new Error(`no templates match ${only ?? ''}`);
    console.log(`Templates: ${picked.join(',')}`);
    let done = 0;
    let skipped = 0;
    for (const name of picked) {
      const outPath = path.join(OUT_DIR, `${name}${suffix}.mp4`);
      if (existsSync(outPath)) {
        console.log(`[${name}] exists, skipping`);
        skipped++;
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const ok = await renderOne(browser, pageUrl, videoUrl, name, doc, outPath);
      if (ok) done++;
      else skipped++;
    }
    console.log(`\nDONE ${done}, SKIPPED ${skipped}`);
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
  assetServer.close();
}

async function renderOne(
  browser: import('playwright').Browser,
  pageUrl: string,
  videoUrl: string,
  name: string,
  doc: unknown,
  outPath: string,
): Promise<boolean> {
  const context = await browser.newContext({ acceptDownloads: true });
  const errors: string[] = [];
  try {
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(pageUrl);
    await page.waitForFunction(() => typeof window.renderGalleryVideo === 'function', null, { timeout: 180000 });
    console.log(`[${name}] rendering (${renderer})…`);
    const downloadPromise = page.waitForEvent('download', { timeout: 0 });
    // Guard against unhandled rejection when evaluate throws first and the
    // orphaned waiter rejects on context close.
    downloadPromise.catch(() => undefined);
    try {
      await page.evaluate(([v, t, d, r]) => window.renderGalleryVideo(v as string, t as string, d as never, r as string), [videoUrl, name, doc, renderer]);
    } catch (err) {
      console.log(`[${name}] SKIP ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
      return false;
    }
    const download = await downloadPromise;
    await download.saveAs(outPath);
    console.log(`[${name}] wrote ${outPath}`);
    return true;
  } catch (err) {
    console.log(`[${name}] SKIP ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
    if (errors.length > 0) console.log(`[${name}] page: ${errors.slice(0, 3).join(' | ')}`);
    return false;
  } finally {
    await context.close();
  }
}
