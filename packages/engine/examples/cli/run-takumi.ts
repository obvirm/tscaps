import path from 'node:path';
import { createServer as createHttpServer } from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser } from 'playwright';

// Usage:
//   pnpm exec tsx cli/run-takumi.ts "<path-to-video.mp4>" takumi|browser default|pico output/<out.mp4>
//
// Drives cli/takumi-runner.html headlessly. The video is served over a local
// HTTP server straight from disk (never copied into the repo); the page runs
// the stock RenderPipeline with real Whisper transcription and saves the mp4.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(HERE, '..');
const OUTPUT_DIR = path.join(PACKAGE_ROOT, 'output');
const FONTS_DIR = path.join(PACKAGE_ROOT, 'input', 'fonts');
const JETBRAINS_MONO_URL =
  'https://github.com/google/fonts/raw/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf';
const JETBRAINS_MONO_FILE = path.join(FONTS_DIR, 'JetBrainsMono-variable.ttf');

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

async function run(): Promise<void> {
  const [videoPath, renderer, style, outName] = process.argv.slice(2);
  if (!videoPath || (renderer !== 'takumi' && renderer !== 'browser') ||
      (style !== 'default' && style !== 'pico') || !outName) {
    throw new Error('Usage: run-takumi.ts "<video.mp4>" takumi|browser default|pico <out.mp4>');
  }
  const size = statSync(videoPath).size;
  console.log(`Video: ${videoPath} (${(size / 1048576).toFixed(1)} MB), renderer=${renderer}, style=${style}`);
  await mkdir(OUTPUT_DIR, { recursive: true });
  // Pico needs JetBrains Mono as local bytes: the page must not depend on
  // per-render CDN fetches (flaky DNS killed a full run). Downloaded once
  // via Node and served over the local asset server.
  const needFont = style === 'pico';
  if (needFont) await ensureFont();
  const assetServer = serveAssets(videoPath);
  await new Promise<void>((resolve) => assetServer.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${addressPort(assetServer)}`;
  const videoUrl = `${baseUrl}/video.mp4`;
  const fontUrl = needFont ? `${baseUrl}/fonts/JetBrainsMono-variable.ttf` : null;
  const server = await startViteDevServer();
  try {
    const browser = await chromium.launch();
    try {
      await renderE2EOnce(server, browser, videoUrl, fontUrl, renderer, style, outName);
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
    assetServer.close();
  }
}

async function ensureFont(): Promise<void> {
  if (existsSync(JETBRAINS_MONO_FILE)) {
    console.log(`Font cached: ${JETBRAINS_MONO_FILE}`);
    return;
  }
  console.log(`Downloading JetBrains Mono variable…`);
  await mkdir(FONTS_DIR, { recursive: true });
  const res = await fetch(JETBRAINS_MONO_URL);
  if (!res.ok) throw new Error(`Font download failed: ${res.status}`);
  await writeFile(JETBRAINS_MONO_FILE, Buffer.from(await res.arrayBuffer()));
  console.log(`Saved ${JETBRAINS_MONO_FILE}`);
}

function serveAssets(videoPath: string) {
  return createHttpServer((req, res) => {
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (req.url === '/video.mp4') {
      const size = statSync(videoPath).size;
      res.writeHead(200, { ...headers, 'Content-Type': 'video/mp4', 'Content-Length': size });
      createReadStream(videoPath).pipe(res);
      return;
    }
    if (req.url === '/fonts/JetBrainsMono-variable.ttf' && existsSync(JETBRAINS_MONO_FILE)) {
      const size = statSync(JETBRAINS_MONO_FILE).size;
      res.writeHead(200, { ...headers, 'Content-Type': 'font/ttf', 'Content-Length': size });
      createReadStream(JETBRAINS_MONO_FILE).pipe(res);
      return;
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
  server: ViteDevServer,
  browser: Browser,
  videoUrl: string,
  fontUrl: string | null,
  renderer: 'takumi' | 'browser',
  style: 'default' | 'pico',
  outName: string,
): Promise<void> {
  const url = resolveServerUrl(server);
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

  console.log(`Opening ${url}cli/takumi-runner.html`);
  await page.goto(`${url}cli/takumi-runner.html`);

  console.log('Running full pipeline (Whisper download + transcription + render). No timeout.');
  const downloadPromise = page.waitForEvent('download', { timeout: 0 });
  try {
    await page.evaluate(
      ([video, font, rend, sty]) => window.renderE2E(video, font, rend, sty),
      [videoUrl, fontUrl, renderer, style] as const,
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
