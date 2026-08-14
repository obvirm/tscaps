import { CaptionContentBoxMeasurer } from '@presentation/editor/services/CaptionContentBoxMeasurer';
import type { ChromeGeometry } from '@presentation/editor/services/OverlayChromeSource';
import { RenderedTransformResolver } from '@presentation/editor/services/RenderedTransformResolver';

const contentBoxMeasurer = new CaptionContentBoxMeasurer();
const transformResolver = new RenderedTransformResolver();

/**
 * Finds the rendered `.segment` of one segment under `scaler`.
 *
 * Matches on `.segment` rather than on the id attribute alone: the
 * scaler also carries the segment's hitzone ghost, which repeats
 * `data-tscaps-segment-id` so selection and the delegated drag start
 * resolve from it, and positioned word hosts repeat it too.
 *
 * Returns `null` while the segment is absent from the DOM — happens
 * briefly during re-derivation between renders.
 */
export function findSegmentElement(scaler: HTMLElement, segmentId: string): HTMLElement | null {
  return scaler.querySelector<HTMLElement>(`.segment[data-tscaps-segment-id="${CSS.escape(segmentId)}"]`);
}

/**
 * Reads the box the chrome around one caption should adopt, in
 * `scaler`-relative coordinates, inflated by a corona on each axis.
 *
 * The content box is a layout measurement, so the scale the caption is
 * painted with has to be put back into it: a segment mid-entrance is
 * drawn at a size its layout box never reports.
 */
export function measureSegmentChrome(
  segment: HTMLElement,
  scaler: HTMLElement,
  horizontalCoronaPx: number,
  verticalCoronaPx: number,
): ChromeGeometry {
  const content = contentBoxMeasurer.measure(segment, scaler);
  const rendered = transformResolver.resolve(segment, scaler);
  const width = content.width * rendered.scaleX + horizontalCoronaPx * 2;
  const height = content.height * rendered.scaleY + verticalCoronaPx * 2;
  return {
    left: content.left + content.width / 2 - width / 2,
    top: content.top + content.height / 2 - height / 2,
    width,
    height,
  };
}
