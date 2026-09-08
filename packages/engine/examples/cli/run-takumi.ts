import path from 'node:path';
import { createServer as createHttpServer } from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser } from 'playwright';

// Usage:
//   full:      run-takumi.ts full "<video.mp4>" takumi|browser default|pico|loki <out.mp4>
//   transcribe once: run-takumi.ts transcribe "<video.mp4>" pico|loki <doc.json>
//   render pinned:   run-takumi.ts renderdoc "<video.mp4>" takumi|browser pico|loki <doc.json> <out.mp4>
//
// Drives cli/takumi-runner.html headlessly. The video is served over a local
// HTTP server straight from disk (never copied into the repo); the page runs
// the stock RenderPipeline with real Whisper transcription and saves the mp4.
// Pinned mode shares ONE transcription across renders so renderer comparisons
// never mix in Whisper variance.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(HERE, '..');
const OUTPUT_DIR = path.join(PACKAGE_ROOT, 'output');
const FONTS_DIR = path.join(PACKAGE_ROOT, 'input', 'fonts');
// Template fonts: Pico's JetBrains Mono is downloaded once from the upstream
// repo; Loki's Komika Axis ships inside this workspace (studio styles).
const TEMPLATE_FONTS = {
  pico: {
    file: 'JetBrainsMono-variable.ttf',
    download: 'https://github.com/google/fonts/raw/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf',
    local: null as string | null,
    // Upright variable only; no italic face ships in this file.
    hasItalic: false,
  },
  loki: {
    file: 'komika-axis.woff2',
    download: null as string | null,
    local: 'E:\\project\\tscaps\\apps\\studio\\src\\styles\\fonts\\komika-axis.woff2',
    // Single Regular face.
    hasItalic: false,
  },
} as const;
type GalleryName = keyof typeof TEMPLATE_FONTS;

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

type RendererName = 'takumi' | 'browser';
type StyleName = 'default' | 'pico' | 'loki';

function isRenderer(value: string | undefined): value is RendererName {
  return value === 'takumi' || value === 'browser';
}

function isStyle(value: string | undefined): value is StyleName {
  return value === 'default' || value === 'pico' || value === 'loki';
}

async function run(): Promise<void> {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === 'full') {
    const [videoPath, renderer, style, outName] = rest;
    if (!videoPath || !isRenderer(renderer) || !isStyle(style) || !outName) {
      throw new Error('Usage: run-takumi.ts full "<video.mp4>" takumi|browser default|pico|loki <out.mp4>');
    }
    await withServers(videoPath, style === 'default' ? null : (style as GalleryName), async ({ browser, pageUrl, videoUrl, fontUrl }) => {
      const gallery = style === 'default' ? null : (style as GalleryName);
      await renderE2EOnce(pageUrl, browser, videoUrl, fontUrl, gallery === null ? false : TEMPLATE_FONTS[gallery].hasItalic, renderer, style, outName);
    });
    return;
  }
  if (mode === 'transcribe') {
    const [videoPath, style, docPath] = rest;
    if (!videoPath || !isStyle(style) || style === 'default' || !docPath) {
      throw new Error('Usage: run-takumi.ts transcribe "<video.mp4>" pico|loki <doc.json>');
    }
    await withServers(videoPath, null, async ({ browser, pageUrl, videoUrl }) => {
      const doc = await transcribeOnce(pageUrl, browser, videoUrl, style);
      const { writeFile: writeJson } = await import('node:fs/promises');
      await writeJson(docPath, JSON.stringify(doc));
      console.log(`Wrote ${docPath}`);
    });
    return;
  }
  if (mode === 'renderdoc') {
    const [videoPath, renderer, style, docPath, outName] = rest;
    if (!videoPath || !isRenderer(renderer) || !isStyle(style) || style === 'default' || !docPath || !outName) {
      throw new Error('Usage: run-takumi.ts renderdoc "<video.mp4>" takumi|browser pico|loki <doc.json> <out.mp4>');
    }
    const { readFile } = await import('node:fs/promises');
    const doc = JSON.parse(await readFile(docPath, 'utf8')) as unknown;
    await withServers(videoPath, style as GalleryName, async ({ browser, pageUrl, videoUrl, fontUrl }) => {
      await renderDocOnce(pageUrl, browser, videoUrl, fontUrl, TEMPLATE_FONTS[style as GalleryName].hasItalic, renderer, style, doc, outName);
    });
    return;
  }
  throw new Error('Usage: run-takumi.ts full|transcribe|renderdoc …');
}

interface Servers {
  browser: Browser;
  pageUrl: string;
  videoUrl: string;
  fontUrl: string | null;
}

async function withServers(
  videoPath: string,
  gallery: GalleryName | null,
  fn: (servers: Servers) => Promise<void>,
): Promise<void> {
  const size = statSync(videoPath).size;
  console.log(`Video: ${videoPath} (${(size / 1048576).toFixed(1)} MB)`);
  await mkdir(OUTPUT_DIR, { recursive: true });
  // Gallery templates need their display font as local bytes: the page must
  // not depend on per-render CDN fetches (flaky DNS killed a full run).
  if (gallery) await ensureFont(gallery);
  const assetServer = serveAssets(videoPath, gallery);
  await new Promise<void>((resolve) => assetServer.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${addressPort(assetServer)}`;
  const servers: Omit<Servers, 'browser' | 'pageUrl'> = {
    videoUrl: `${baseUrl}/video.mp4`,
    fontUrl: gallery ? `${baseUrl}/fonts/${TEMPLATE_FONTS[gallery].file}` : null,
  };
  const server = await startViteDevServer();
  try {
    const browser = await chromium.launch();
    try {
      const pageUrl = `${resolveServerUrl(server)}cli/takumi-runner.html`;
      await fn({ browser, pageUrl, ...servers });
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
    assetServer.close();
  }
}

async function openPage(browser: Browser, pageUrl: string) {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const failures: string[] = [];
  page.on('console', (msg) => {
    console.log(`[page ${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') failures.push(msg.text());
  });
  page.on('pageerror', (err) => {
    console.error('[page error]', err.message);
    failures.push(err.message);
  });
  console.log(`Opening ${pageUrl}`);
  await page.goto(pageUrl);
  return { page, failures };
}

async function transcribeOnce(pageUrl: string, browser: Browser, videoUrl: string, style: StyleName) {
  const { page, failures } = await openPage(browser, pageUrl);
  console.log('Transcribing (Whisper download + inference). No timeout.');
  try {
    return await page.evaluate(([video, sty]) => window.transcribeOnly(video, sty), [videoUrl, style] as const);
  } catch (err) {
    console.error(`[transcribeOnly threw] ${err instanceof Error ? err.message : String(err)}`);
    if (failures.length > 0) console.error(`[page failures]\n${failures.join('\n')}`);
    throw err;
  }
}

async function renderDocOnce(
  pageUrl: string,
  browser: Browser,
  videoUrl: string,
  fontUrl: string | null,
  hasItalicFont: boolean,
  renderer: RendererName,
  style: StyleName,
  doc: unknown,
  outName: string,
) {
  const { page, failures } = await openPage(browser, pageUrl);
  console.log(`Rendering pinned document with ${renderer}/${style}. No timeout.`);
  const downloadPromise = page.waitForEvent('download', { timeout: 0 });
  try {
    await page.evaluate(
      ([video, font, italic, rend, sty, documentJson]) =>
        window.renderFromDocument(video, font, italic, rend, sty, documentJson as never),
      [videoUrl, fontUrl, hasItalicFont, renderer, style, doc] as const,
    );
  } catch (err) {
    console.error(`[renderFromDocument threw] ${err instanceof Error ? err.message : String(err)}`);
    if (failures.length > 0) console.error(`[page failures]\n${failures.join('\n')}`);
    throw err;
  }
  const download = await downloadPromise;
  const outputPath = path.join(OUTPUT_DIR, outName);
  await download.saveAs(outputPath);
  console.log(`Wrote ${outputPath}`);
}

async function ensureFont(name: GalleryName): Promise<void> {
  const spec = TEMPLATE_FONTS[name];
  const dest = path.join(FONTS_DIR, spec.file);
  if (existsSync(dest)) {
    console.log(`Font cached: ${dest}`);
    return;
  }
  await mkdir(FONTS_DIR, { recursive: true });
  if (spec.local !== null) {
    const { copyFile } = await import('node:fs/promises');
    await copyFile(spec.local, dest);
    console.log(`Font copied: ${dest}`);
    return;
  }
  console.log(`Downloading font ${spec.file}…`);
  const res = await fetch(spec.download!);
  if (!res.ok) throw new Error(`Font download failed: ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`Saved ${dest}`);
}

function serveAssets(videoPath: string, gallery: GalleryName | null) {
  return createHttpServer((req, res) => {
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (req.url === '/video.mp4') {
      const size = statSync(videoPath).size;
      res.writeHead(200, { ...headers, 'Content-Type': 'video/mp4', 'Content-Length': size });
      createReadStream(videoPath).pipe(res);
      return;
    }
    if (gallery !== null && req.url === `/fonts/${TEMPLATE_FONTS[gallery].file}`) {
      const file = path.join(FONTS_DIR, TEMPLATE_FONTS[gallery].file);
      if (existsSync(file)) {
        const size = statSync(file).size;
        res.writeHead(200, { ...headers, 'Content-Type': 'font/ttf', 'Content-Length': size });
        createReadStream(file).pipe(res);
        return;
      }
    }
    res.writeHead(404).end();
  });
}

function addressPort(server: ReturnType<typeof createHttpServer>): number {
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Video server has no port');
  return address.port;
}

async function startViteDevServer(): Promise<ViteDevServer> {
  const server = await createServer({
    root: PACKAGE_ROOT,
    configFile: path.join(PACKAGE_ROOT, 'vite.config.ts'),
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  return server;
}

async function renderE2EOnce(
  pageUrl: string,
  browser: Browser,
  videoUrl: string,
  fontUrl: string | null,
  hasItalicFont: boolean,
  renderer: RendererName,
  style: StyleName,
  outName: string,
): Promise<void> {
  const { page, failures } = await openPage(browser, pageUrl);

  console.log('Running full pipeline (Whisper download + transcription + render). No timeout.');
  const downloadPromise = page.waitForEvent('download', { timeout: 0 });
  try {
    await page.evaluate(
      ([video, font, italic, rend, sty]) => window.renderE2E(video, font, italic, rend, sty),
      [videoUrl, fontUrl, hasItalicFont, renderer, style] as const,
    );
  } catch (err) {
    console.error(`[renderE2E threw] ${err instanceof Error ? err.message : String(err)}`);
    if (failures.length > 0) console.error(`[page failures]\n${failures.join('\n')}`);
    throw err;
  }
  const download = await downloadPromise;

  const outputPath = path.join(OUTPUT_DIR, outName);
  await download.saveAs(outputPath);
  console.log(`Wrote ${outputPath}`);
}

function resolveServerUrl(server: ViteDevServer): string {
  const url = server.resolvedUrls?.local?.[0];
  if (url === undefined) throw new Error('Vite dev server is running but exposes no local URL');
  return url;
}
