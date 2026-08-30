interface FrameSurface {
  readonly canvas: OffscreenCanvas;
  readonly context: OffscreenCanvasRenderingContext2D;
}

/**
 * Keeps one video frame's pixels readable after its bitmap is gone.
 *
 * Posting a bitmap to a worker transfers it, and a caller that reads
 * frames ahead of itself has already moved the video element on to the
 * next seek — so neither the bitmap nor the element can answer a
 * question that only comes up once the worker has replied. Holding the
 * frame first keeps that answer available.
 *
 * The same canvas is reused across frames, replaced only when the
 * frame size changes, and the pixels it returns are a 1:1 copy:
 * nothing is resampled on the way in.
 */
export class VideoFramePixelBuffer {
  private surface: FrameSurface | null = null;

  hold(bitmap: ImageBitmap): OffscreenCanvas {
    const surface = this.surfaceSized(bitmap.width, bitmap.height);
    surface.context.drawImage(bitmap, 0, 0);
    return surface.canvas;
  }

  private surfaceSized(width: number, height: number): FrameSurface {
    const current = this.surface;
    if (current !== null && current.canvas.width === width && current.canvas.height === height) {
      return current;
    }
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) throw new Error('OffscreenCanvas 2D context is unavailable');
    const surface = { canvas, context };
    this.surface = surface;
    return surface;
  }
}
