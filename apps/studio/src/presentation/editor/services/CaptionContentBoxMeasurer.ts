/**
 * Content-only bounding box of a segment's caption in scaler-relative
 * coordinates.
 *
 * The engine's `rendering.padding` inflates `.segment` with a symmetric
 * safety-bleed so template filters and animations have room to paint
 * without being clipped. Template CSS itself is also free to add
 * padding on `.segment` (asymmetric window chrome, bubble insets, …).
 * Neither belongs in the visible caption box, so consumers that draw
 * selection outlines or size a click surface around the text should
 * measure through this service instead of `getBoundingClientRect` or
 * `offsetWidth`.
 */
export interface CaptionContentBox {
  /** Left offset from the scaler's viewport-left, in CSS pixels. */
  readonly left: number;
  /** Top offset from the scaler's viewport-top, in CSS pixels. */
  readonly top: number;
  /** Content-only width in CSS pixels, unrotated. */
  readonly width: number;
  /** Content-only height in CSS pixels, unrotated. */
  readonly height: number;
}

export class CaptionContentBoxMeasurer {
  /**
   * Returns the caption content box for `segmentElement`, expressed in
   * `scaler`-relative coordinates. Size comes from the segment's
   * layout box minus its computed padding, so it is invariant to
   * segment rotation. The center is taken from the segment's rendered
   * bounding rect so any template translate on `.segment` (behind-actor
   * lift, animation transforms) is already baked in.
   *
   * For asymmetric padding, the caption center is offset from the
   * segment center by half the padding-difference on each axis. The
   * offset is applied without rotating it — mixing asymmetric padding
   * with a rotated segment produces a few-pixel misalignment, accepted
   * as a corner case not worth the extra math.
   */
  measure(segmentElement: HTMLElement, scaler: HTMLElement): CaptionContentBox {
    const styles = window.getComputedStyle(segmentElement);
    const paddingLeft = this.parsePx(styles.paddingLeft);
    const paddingRight = this.parsePx(styles.paddingRight);
    const paddingTop = this.parsePx(styles.paddingTop);
    const paddingBottom = this.parsePx(styles.paddingBottom);

    const contentWidth = Math.max(0, segmentElement.offsetWidth - paddingLeft - paddingRight);
    const contentHeight = Math.max(0, segmentElement.offsetHeight - paddingTop - paddingBottom);

    const segmentBox = segmentElement.getBoundingClientRect();
    const scalerBox = scaler.getBoundingClientRect();

    const segmentCenterX = segmentBox.left + segmentBox.width / 2 - scalerBox.left;
    const segmentCenterY = segmentBox.top + segmentBox.height / 2 - scalerBox.top;
    const contentCenterX = segmentCenterX + (paddingLeft - paddingRight) / 2;
    const contentCenterY = segmentCenterY + (paddingTop - paddingBottom) / 2;

    return {
      left: contentCenterX - contentWidth / 2,
      top: contentCenterY - contentHeight / 2,
      width: contentWidth,
      height: contentHeight,
    };
  }

  private parsePx(value: string): number {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
