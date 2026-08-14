import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __tscapsE2E?: {
      ready: boolean;
      editorPath: string;
      setVideo: (blob: Blob, opts?: { publishPreview?: boolean }) => Promise<void>;
      setVideoLayout: (width: number, height: number) => void;
      setDocument: (json: unknown) => Promise<void>;
      seekPreview: (sourceTimeSec: number) => void;
    };
  }
}

/**
 * Boots the editor route with every API call answered in-browser, the
 * same approach export.spec uses, so the suite runs identically against
 * builds with and without a backend.
 *
 * The editor route is discovered through the e2e hook instead of being
 * hardcoded, because the app mounts under a different base path per
 * distribution.
 */
export async function bootEditor(page: Page): Promise<void> {
  await page.route('**/v1/**', (route) => route.fulfill({ status: 401, body: '' }));
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => window.__tscapsE2E?.ready === true, null, { timeout: 30_000 });
  const editorPath = await page.evaluate(() => window.__tscapsE2E!.editorPath);
  await page.goto(`${editorPath}?e2e=1`);
  await page.waitForFunction(() => window.__tscapsE2E?.ready === true, null, { timeout: 30_000 });
}

/** Puts a transcription result into the editor, so a spec can reach the caption UI without running one. */
export async function setDocumentJson(page: Page, documentJson: unknown): Promise<void> {
  await page.evaluate(async (json: unknown) => {
    await window.__tscapsE2E!.setDocument(json);
  }, documentJson);
}

/**
 * Boots the editor with a video, a frame and a transcription in place —
 * everything the caption surface needs to paint.
 */
export async function bootEditorWithCaptions(
  page: Page,
  videoBytes: Buffer,
  documentJson: unknown,
  frame: { width: number; height: number } = { width: 720, height: 1280 },
): Promise<void> {
  await bootEditor(page);
  await page.evaluate(async (byteArray: number[]) => {
    const blob = new Blob([new Uint8Array(byteArray)], { type: 'video/mp4' });
    await window.__tscapsE2E!.setVideo(blob);
  }, Array.from(videoBytes));
  await page.evaluate(({ width, height }) => {
    window.__tscapsE2E!.setVideoLayout(width, height);
  }, frame);
  await setDocumentJson(page, documentJson);
}

export async function setVideoBytes(page: Page, bytes: Buffer): Promise<void> {
  // `publishPreview: false` keeps the store in the real pre-preprocessing
  // state, so only the load-time probe can feed the video facts.
  await page.evaluate(async (byteArray: number[]) => {
    const blob = new Blob([new Uint8Array(byteArray)], { type: 'video/mp4' });
    await window.__tscapsE2E!.setVideo(blob, { publishPreview: false });
  }, Array.from(bytes));
}
