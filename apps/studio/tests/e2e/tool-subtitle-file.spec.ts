import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, 'fixtures');

const TOOL_PATH = '/app/local/editor/tools/add-vtt-to-video';

// sample-with-audio.mp4 is a 2s clip with an AAC track, regenerated with:
//   ffmpeg -f lavfi -i testsrc=duration=2:size=128x128:rate=10 \
//     -f lavfi -i sine=frequency=440:duration=2 \
//     -c:v libopenh264 -b:v 80k -pix_fmt yuv420p -c:a aac -shortest sample-with-audio.mp4
// The audio track is load-bearing: the pipeline skips transcription
// entirely for a video without one, so a silent fixture never reaches
// the subtitle parser.
const VIDEO = path.join(FIXTURES, 'sample-with-audio.mp4');

// A blank line inside a cue payload. The half below it has no timecode
// of its own, which used to take the whole file down and, through the
// failure, restart the pipeline forever.
const VTT_WITH_ORPHAN_BLOCK = [
  'WEBVTT',
  '',
  '00:00:00.500 --> 00:00:01.000',
  'first half',
  '',
  'orphaned second half',
  '',
  '00:00:01.200 --> 00:00:01.800',
  'intact cue',
].join('\n');

const VTT_WITH_NO_TIMECODES = ['WEBVTT', '', 'just prose', '', 'and more prose'].join('\n');

/**
 * Stages a video + VTT pair the way the marketing site does, then
 * opens the tool on it. Returns the number of times the preprocessing
 * pipeline reported a failure.
 */
async function runToolOn(page: Page, vtt: string): Promise<() => number> {
  const videoBytes = await readFile(VIDEO);
  const failures: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('[preprocess] failed')) failures.push(message.text());
  });

  const handoffId = 'e2e0000000000000000000000000000f';
  await page.goto('/');
  await page.evaluate(async (staged) => {
    const root = await navigator.storage.getDirectory();
    const handoff = await root.getDirectoryHandle('handoff', { create: true });
    const session = await handoff.getDirectoryHandle(staged.id, { create: true });
    const write = async (name: string, payload: BlobPart) => {
      const handle = await session.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(payload);
      await writable.close();
    };
    await write('video.bin', new Uint8Array(staged.video));
    await write('video.meta', JSON.stringify({ name: 'sample.mp4', type: 'video/mp4' }));
    await write('vtt.txt', staged.vtt);
    await write('_stored', JSON.stringify({ storedAt: Date.now() }));
  }, { id: handoffId, video: [...videoBytes], vtt });

  await page.goto(`${TOOL_PATH}?handoff=${handoffId}`);
  return () => failures.length;
}

test('a cue block with no timecode costs its own text and nothing else', async ({ page }) => {
  const failureCount = await runToolOn(page, VTT_WITH_ORPHAN_BLOCK);

  await expect(page.getByText('orphaned second half')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Got it' })).toBeVisible();
  expect(failureCount()).toBe(0);
});

test('a file with no timecodes at all is reported once, not retried forever', async ({ page }) => {
  const failureCount = await runToolOn(page, VTT_WITH_NO_TIMECODES);

  await expect(page.getByRole('heading', { name: "Couldn't read your subtitle file" })).toBeVisible();
  // Long enough for the loop this guards against to fire hundreds of
  // times: it ran at ~50 pipelines per second.
  await page.waitForTimeout(3_000);
  expect(failureCount()).toBe(1);
});
