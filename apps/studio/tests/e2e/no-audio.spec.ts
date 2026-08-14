import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootEditor, setVideoBytes } from './support/editorBoot';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, 'fixtures');

// no-audio-sample.mp4 is a 1s H.264 video with no audio track, regenerated with:
//   ffmpeg -f lavfi -i testsrc=duration=1:size=64x64:rate=5 \
//     -c:v libopenh264 -b:v 50k -pix_fmt yuv420p -an no-audio-sample.mp4
// There is no speech to transcribe, so the dialog must warn, still allow
// starting, and the pipeline must open the editor with an empty
// transcript instead of failing inside the transcriber.
test('video without an audio track warns, starts, and opens the editor', async ({ page }) => {
  await bootEditor(page);

  const videoBuf = await readFile(path.join(FIXTURES, 'no-audio-sample.mp4'));
  await setVideoBytes(page, videoBuf);

  await expect(page.getByTestId('no-audio-track-notice')).toBeVisible();
  const start = page.getByTestId('start-flow-primary');
  await expect(start).toBeEnabled();
  await start.click();

  // The pipeline still generates the preview proxy, so give it room.
  await expect(start).toBeHidden({ timeout: 90_000 });
  await expect(page.getByRole('alert')).toBeHidden();

  // The empty transcript must still offer a way to write the first
  // caption by hand.
  await page.getByRole('tab', { name: 'Transcript' }).click();
  await expect(page.getByText('No captions yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Add first scene' }).click();
  await expect(page.getByText('No captions yet.')).toBeHidden();
});
