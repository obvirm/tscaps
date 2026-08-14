import { CssClass } from '@modules/document/CssClass';

/**
 * Default rule for the `CssClass.VIDEO_FRAME_LAYER` element: positions
 * the layer over the subtitle's painted region via the
 * `--subtitle-region-*` custom properties and paints the current
 * frame slice from `--video-frame`. Class-level specificity so
 * sheet-scoped overrides always win.
 *
 * `max-width: none; max-height: none` defeats consumer CSS resets
 * (e.g. Tailwind's `img, video { max-width: 100% }`) that would
 * clip the layer to its content-hugging segment parent and break
 * the region geometry.
 */
export const VIDEO_FRAME_LAYER_BASELINE_CSS = `.${CssClass.VIDEO_FRAME_LAYER} { position: absolute; left: var(--subtitle-region-x, 0); top: var(--subtitle-region-y, 0); width: var(--subtitle-region-width, 100%); height: var(--subtitle-region-height, 100%); max-width: none; max-height: none; background-image: var(--video-frame, none); background-size: 100% 100%; pointer-events: none; object-fit: fill; }`;
