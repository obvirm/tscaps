import path from 'node:path';
import { createServer as createHttpServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser } from 'playwright';

// Usage:
//   pnpm exec tsx cli/run-takumi.ts "<path-to-video.mp4>" takumi output/takumi-spongebob.mp4
//   pnpm exec tsx cli/run-takumi.ts "<path-to-video.mp4>" browser output/baseline-spongebob.mp4
//
// Drives cli/takumi-runner.html headlessly. The video is served over a local
// HTTP server straight from disk (never copied into the repo); the page runs
// the stock RenderPipeline with real Whisper transcription and saves the mp4.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(HERE, '..');
const OUTPUT_DIR = path.join(PACKAGE_ROOT, 'output');

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

async function run(): Promise<void> {
  const [videoPath, renderer, outName] = process.argv.slice(2);
  if (!videoPath || (renderer !== 'takumi' && renderer !== 'browser') || !outName) {
    throw new Error('Usage: run-takumi.ts "<video.mp4>" takumi|browser <out.mp4>');
  }
  const size = statSync(videoPath).size;
  console.log(`Video: ${videoPath} (${(size / 1048576).toFixed(1)} MB), renderer=${renderer}`);
  await mkdir(OUTPUT_DIR, { recursive: true });
  const videoServer = serveVideo(videoPath);
  await new Promise<void>((resolve) => videoServer.listen(0, '127.0.0.1', resolve));
  const videoUrl = `http://127.0.0.1:${addressPort(videoServer)}/video.mp4`;
  const server = await startViteDevServer();
  try {
    const browser = await chromium.launch();
    try {
      await renderE2EOnce(server, browser, videoUrl, renderer === 'takumi', outName);
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
    videoServer.close();
  }
}

function serveVideo(videoPath: string) {
  return createHttpServer((req, res) => {
    if (req.url !== '/video.mp4') {
      res.writeHead(404).end();
      return;
    }
    const size = statSync(videoPath).size;
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': size,
      'Access-Control-Allow-Origin': '*',
    });
    createReadStream(videoPath).pipe(res);
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
  useTakumi: boolean,
  outName: string,
): Promise<void> {
  const url = resolveServerUrl(server);
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  page.on('console', (msg) => console.log(`[page ${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => console.error('[page error]', err.message));

  console.log(`Opening ${url}cli/takumi-runner.html`);
  await page.goto(`${url}cli/takumi-runner.html`);

  console.log('Running full pipeline (Whisper download + transcription + render). No timeout.');
  const downloadPromise = page.waitForEvent('download', { timeout: 0 });
  await page.evaluate(([video, takumi]) => window.renderE2E(video, takumi), [videoUrl, useTakumi] as const);
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
