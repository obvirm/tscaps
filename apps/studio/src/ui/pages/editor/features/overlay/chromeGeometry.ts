import type { ChromeGeometry } from '@presentation/editor/services/OverlayChromeSource';
import { measureWordRotatedBox } from '@ui/pages/editor/features/overlay/wordRotatedBoxProbe';

// Inflates a word's chrome box by this many px on each side so the
// stroke keeps a small gap from the glyphs. The ring, the resize
// handles and the rotate frame all take it: they are drawn as one
// rectangle in the user's eye and any difference reads as misalignment.
const WORD_CHROME_PADDING_PX = 3;

/** Reads the box the chrome around one word should adopt, in `scaler`-relative coordinates. */
export function measureWordChrome(span: HTMLElement, scaler: HTMLElement): ChromeGeometry {
  const measured = measureWordRotatedBox(span, scaler);
  const scalerBox = scaler.getBoundingClientRect();
  const width = measured.unrotatedWidth + WORD_CHROME_PADDING_PX * 2;
  const height = measured.unrotatedHeight + WORD_CHROME_PADDING_PX * 2;
  return {
    left: measured.visualCenterX - width / 2 - scalerBox.left,
    top: measured.visualCenterY - height / 2 - scalerBox.top,
    width,
    height,
    transform: measured.transform,
  };
}

/** Writes a measured geometry onto a chrome box. */
export function applyChromeGeometry(box: HTMLElement, geometry: ChromeGeometry): void {
  box.style.left = `${geometry.left}px`;
  box.style.top = `${geometry.top}px`;
  box.style.width = `${geometry.width}px`;
  box.style.height = `${geometry.height}px`;
  if (geometry.transform === undefined) return;
  box.style.transform = geometry.transform;
  box.style.transformOrigin = 'center';
}
