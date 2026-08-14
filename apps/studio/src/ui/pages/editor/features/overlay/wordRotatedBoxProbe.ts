import { RenderedTransformResolver } from '@presentation/editor/services/RenderedTransformResolver';

const transformResolver = new RenderedTransformResolver();

export interface WordRotatedBoxLayout {
  /** Visual centre of the rendered word in viewport (`clientX`/`clientY`) coordinates. */
  readonly visualCenterX: number;
  readonly visualCenterY: number;
  /** Painted dimensions before any rotation — the size the chrome
   *  frame should adopt so its corners land at the rotated glyph box,
   *  not at the axis-aligned bounding rect. Scale is already in them,
   *  so a word mid-`scale-in` reports the size it is drawn at rather
   *  than the size it will come to rest at. */
  readonly unrotatedWidth: number;
  readonly unrotatedHeight: number;
  /** CSS transform value (e.g. `"rotate(15deg)"`) matching the word's
   *  effective rotation — ready to assign to `style.transform` on the
   *  chrome frame so its visual orientation tracks the rotated word.
   *  `"none"` when the effective rotation is zero. */
  readonly transform: string;
}

/**
 * Finds the rendered span of one word under `scaler`. There is at most
 * one per word id, and it is a sibling of the segment tree rather than
 * a descendant whenever the word carries a placement, so the search
 * starts at the scaler.
 *
 * Returns `null` while the span is absent from the DOM — happens
 * briefly during re-derivation between renders.
 */
export function findWordSpan(scaler: HTMLElement, wordId: string): HTMLElement | null {
  return scaler.querySelector<HTMLElement>(`[data-tscaps-word-id="${CSS.escape(wordId)}"]`);
}

/**
 * Measures the rotated glyph box of one rendered word so chrome
 * components (selection ring, resize handles, rotation handle) can
 * frame the glyphs even when the word — or any of its ancestors —
 * carries a rotation.
 *
 * The effective rotation walks every ancestor from the span up to
 * `scope` (exclusive) and sums each element's standalone `rotate` plus
 * any rotation embedded in its `transform` matrix — so a word inside a
 * segment wrapper that carries `transform: rotate(...)` rotates the
 * chrome by the segment's angle even when the word itself has none.
 */
export function measureWordRotatedBox(span: HTMLElement, scope: HTMLElement): WordRotatedBoxLayout {
  const rect = span.getBoundingClientRect();
  const rendered = transformResolver.resolve(span, scope);
  return {
    visualCenterX: rect.left + rect.width / 2,
    visualCenterY: rect.top + rect.height / 2,
    unrotatedWidth: span.offsetWidth * rendered.scaleX,
    unrotatedHeight: span.offsetHeight * rendered.scaleY,
    transform: rendered.rotationDeg === 0 ? 'none' : `rotate(${rendered.rotationDeg}deg)`,
  };
}
