import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootEditorWithCaptions } from './support/editorBoot';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, 'fixtures');

/**
 * Overlay chrome is a ghost measured from the live DOM, so it does not
 * throw and does not look wrong in the moment it is drawn — it only
 * reads wrong once the thing it frames moves for a reason it was not
 * told about. Every case here is one of those reasons.
 *
 * "It followed" can only mean it still frames what it is drawn around;
 * anything looser passes on chrome that never moved at all.
 */

const CENTER_TOLERANCE_PX = 3;

// Far enough inside the hitzone's 32/22px corona to miss every word, so
// the click selects the segment rather than a word inside it.
const CORONA_CLICK_OFFSET_PX = 6;

test('word chrome follows the word when a field resizes it', async ({ page }) => {
  await bootEditor(page);

  // The fixture's segments overlap in time, and the one painted last is
  // the one on top — a word under it takes no clicks.
  const word = page.locator('.subtitle-overlay-scaler .segment').last().locator('.word').first();
  await word.click();
  const ring = page.locator('.subtitle-overlay-word-selection');
  await expect(ring).toBeVisible();
  const widthBefore = (await boxOf(word)).width;

  // A word's size is a ratio to the text around it, 100 meaning "same".
  await setSizeField(page, '250');

  await expect.poll(async () => (await boxOf(word)).width).toBeGreaterThan(widthBefore);
  await expectFrames(ring, word);
});

test('segment chrome follows the caption when a field resizes it', async ({ page }) => {
  await bootEditor(page);

  const hitzone = page.locator('.subtitle-overlay-segment-hitzone').first();
  await hitzone.click({ position: { x: CORONA_CLICK_OFFSET_PX, y: CORONA_CLICK_OFFSET_PX } });
  const chrome = page.locator('.subtitle-overlay-segment-chrome.is-selected');
  await expect(chrome).toBeVisible();

  const segment = page.locator('.subtitle-overlay-scaler .segment').first();
  const heightBefore = (await boxOf(segment)).height;

  // A segment's size is its share of the frame height, in `cqh`.
  const current = Number(await page.getByLabel('Size value').first().inputValue());
  await setSizeField(page, String(Math.min(25, current * 1.6)));

  await expect.poll(async () => (await boxOf(segment)).height).toBeGreaterThan(heightBefore);
  await expectFrames(chrome, segment);
});

/**
 * A turn is the case a `ResizeObserver` cannot report: rotating an
 * element leaves its layout box exactly as it was, so nothing observes
 * it and only the overlay geometry says it happened.
 */
test('word chrome follows the word when a field turns it', async ({ page }) => {
  await bootEditor(page);

  const word = page.locator('.subtitle-overlay-scaler .segment').last().locator('.word').first();
  await word.click();
  const ring = page.locator('.subtitle-overlay-word-selection');
  await expect(ring).toBeVisible();

  await setField(page, 'Rotation value', '30');

  await expect.poll(() => ring.evaluate((el) => el.style.transform)).toContain('rotate(30');
  await expectFrames(ring, word);
});

/**
 * The one nothing else can stand in for: a caption mid-entrance is moved
 * by a variable written on the playhead tick, with no React render and
 * no change to its layout box. The animation is given here rather than
 * picked in the panel, but it runs the way every caption animation runs
 * — paused, with the frame selected by the segment's own clock.
 */
test('chrome follows a caption the playhead is animating', async ({ page }) => {
  await bootEditor(page);

  // Picked before the entrance exists, because a caption caught at the
  // start of one is 120px outside the video and the click lands on the
  // stage behind it. Which of the two the click meets depends on where
  // the playhead sits when the style goes in, so selecting first is the
  // difference between a test that asserts tracking and one that races.
  const hitzone = page.locator('.subtitle-overlay-segment-hitzone').first();
  await hitzone.click({ position: { x: CORONA_CLICK_OFFSET_PX, y: CORONA_CLICK_OFFSET_PX } });
  const chrome = page.locator('.subtitle-overlay-segment-chrome.is-selected');
  await expect(chrome).toBeVisible();

  await givePaintedSegmentsAnEntrance(page);

  const segment = page.locator('.subtitle-overlay-scaler .segment').first();

  // Past the entrance, where the caption comes to rest.
  await seek(page, 0.4);
  const restingLeft = (await boxOf(segment)).x;
  await expectFrames(chrome, segment);

  // Mid-entrance: still sliding in, well left of where it lands.
  await seek(page, 0.02);
  await expect.poll(async () => (await boxOf(segment)).x).toBeLessThan(restingLeft - 20);
  await expectFrames(chrome, segment);

  // And back, so chrome that moved once and stuck is caught too.
  await seek(page, 0.4);
  await expect.poll(async () => Math.abs((await boxOf(segment)).x - restingLeft)).toBeLessThan(2);
  await expectFrames(chrome, segment);
});

async function bootEditor(page: Page): Promise<void> {
  await bootEditorWithCaptions(
    page,
    await readFile(path.join(FIXTURES, 'sample.mp4')),
    JSON.parse(await readFile(path.join(FIXTURES, 'document.json'), 'utf8')),
  );
  await page.locator('.subtitle-overlay-scaler .word').first().waitFor();
}

/**
 * Slides every painted segment in over 200ms, anchored to the clock the
 * framework pauses every caption animation against.
 */
async function givePaintedSegmentsAnEntrance(page: Page): Promise<void> {
  await page.addStyleTag({ content: `
    @keyframes e2e-slide-in { from { transform: translateX(-120px); } to { transform: translateX(0); } }
    .subtitle-overlay-scaler .segment {
      animation: e2e-slide-in 200ms var(--on-segment-starts) linear both paused !important;
    }
  ` });
}

async function seek(page: Page, sourceTimeSec: number): Promise<void> {
  await page.evaluate((time: number) => window.__tscapsE2E!.seekPreview(time), sourceTimeSec);
}

async function setSizeField(page: Page, value: string): Promise<void> {
  await setField(page, 'Size value', value);
}

// The inspector is not a mode: picking the element is what opens it, and
// it opens on its Style tab, so there is nothing to click on the way in.
async function setField(page: Page, label: string, value: string): Promise<void> {
  const chip = page.getByLabel(label).first();
  await chip.fill(value);
  await chip.press('Enter');
}

async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element is not rendered');
  return box;
}

/** Asserts `chrome` is still centred on `framed`, whatever either of them did to get there. */
async function expectFrames(chrome: Locator, framed: Locator): Promise<void> {
  await expect.poll(async () => {
    const chromeBox = await boxOf(chrome);
    const framedBox = await boxOf(framed);
    return Math.max(
      Math.abs((chromeBox.x + chromeBox.width / 2) - (framedBox.x + framedBox.width / 2)),
      Math.abs((chromeBox.y + chromeBox.height / 2) - (framedBox.y + framedBox.height / 2)),
    );
  }).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
}
