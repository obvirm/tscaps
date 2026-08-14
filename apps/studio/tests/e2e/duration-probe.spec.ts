import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootEditor, setVideoBytes } from './support/editorBoot';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, 'fixtures');

// frag-sample.mp4 is a 1s fragmented MP4 (empty moov), regenerated with:
//   ffmpeg -f lavfi -i testsrc=duration=1:size=64x64:rate=5 \
//     -c:v libopenh264 -b:v 50k -pix_fmt yuv420p \
//     -movflags frag_keyframe+empty_moov frag-sample.mp4
// Its container metadata declares no duration, so accepting it requires
// the probe's packet-scan fallback. Before v0.5.14 this file left the
// start dialog on "Analyzing video" forever with Start disabled.
test('video without a metadata duration is accepted via the packet-scan fallback', async ({ page }) => {
  await bootEditor(page);

  const videoBuf = await readFile(path.join(FIXTURES, 'frag-sample.mp4'));
  await setVideoBytes(page, videoBuf);

  await expect(page.getByTestId('start-flow-primary')).toBeEnabled();
  await expect(page.getByText('Analyzing video')).toBeHidden();
  await expect(page.getByTestId('unreadable-video-notice')).toBeHidden();
});

test('file the demuxer cannot read at all is rejected with the unreadable notice', async ({ page }) => {
  await bootEditor(page);

  await setVideoBytes(page, Buffer.from('this is not a video container, just bytes'));

  await expect(page.getByTestId('unreadable-video-notice')).toBeVisible();
  await expect(page.getByTestId('start-flow-primary')).toBeDisabled();
});
