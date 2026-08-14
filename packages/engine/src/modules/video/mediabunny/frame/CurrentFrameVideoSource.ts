import type { VideoFrameSource, VideoFrameRegion } from '@modules/rendering/types/VideoFrameSource';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import { profiler } from '@modules/profiling/Profiler';

/**
 * Single-slot `VideoFrameSource`. {@link setCurrent} stores one
 * decoded frame at a timestamp; {@link getFrameAt} serves only that
 * frame and only at that same timestamp. Querying any other
 * timestamp throws.
 */
export class CurrentFrameVideoSource implements VideoFrameSource {

  // Any mismatch beyond IEEE-754 noise is a coordination bug between
  // the producer and the subtitle renderer.
  private static readonly TIMESTAMP_TOLERANCE_S = 1e-6;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private currentTimestamp: number | null = null;

  constructor(width: number, height: number) {
    this.canvas = this.createCanvas(width, height);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is not available in this environment.');
    }
    this.ctx = ctx;
  }

  /**
   * Stores `frame` as the only frame `getFrameAt` will serve until
   * the next `setCurrent`, keyed on `timestamp`.
   */
  setCurrent(timestamp: number, frame: DecodedVideoFrame): void {
    this.currentTimestamp = timestamp;
    profiler.time('CurrentFrameVideoSource.draw', () =>
      frame.draw(this.ctx, 0, 0, this.canvas.width, this.canvas.height),
    );
  }

  async getFrameAt(timeSeconds: number, jpegQuality: number, region?: VideoFrameRegion): Promise<string> {
    if (this.currentTimestamp === null) {
      throw new Error('CurrentFrameVideoSource.getFrameAt called before any setCurrent.');
    }
    if (Math.abs(this.currentTimestamp - timeSeconds) > CurrentFrameVideoSource.TIMESTAMP_TOLERANCE_S) {
      throw new Error(
        `CurrentFrameVideoSource: requested timestamp ${timeSeconds}, ` +
          `but the current slot holds ${this.currentTimestamp}.`,
      );
    }
    return profiler.time('CurrentFrameVideoSource.encode', () => this.encode(region, jpegQuality));
  }

  private encode(region: VideoFrameRegion | undefined, jpegQuality: number): string {
    const clipped = region ? this.clipToCanvas(region) : null;
    if (!clipped || clipped.width === 0 || clipped.height === 0) {
      return this.encodeJpeg(this.canvas, jpegQuality);
    }
    return this.encodeJpeg(this.cropTo(clipped), jpegQuality);
  }

  private cropTo(clipped: VideoFrameRegion): HTMLCanvasElement {
    const cropCanvas = this.createCanvas(clipped.width, clipped.height);
    const cropCtx = profiler.time('CurrentFrameVideoSource.cropCanvasContext', () =>
      cropCanvas.getContext('2d'),
    );
    if (!cropCtx) {
      throw new Error('Canvas 2D context is not available for cropping.');
    }
    profiler.time('CurrentFrameVideoSource.cropDraw', () =>
      cropCtx.drawImage(
        this.canvas,
        clipped.x, clipped.y, clipped.width, clipped.height,
        0, 0, clipped.width, clipped.height,
      ),
    );
    return cropCanvas;
  }

  // Chosen for predictability over raw speed. `toDataURL` encodes inline;
  // `OffscreenCanvas.convertToBlob` defers to the browser's async image
  // scheduler, which was measured taking ~1s per call instead of the usual
  // few ms, under a load that could not be pinned down or reproduced.
  // Output is byte-identical between the two on Chrome and Firefox, and the
  // async overhead is per-call rather than per-pixel, so the two only differ
  // meaningfully at small crop sizes. The tradeoff accepted here is that
  // encoding inline blocks the main thread for the whole encode, and that a
  // DOM canvas rules out ever running this step in a Worker.
  // Benchmarked in experiments/jpeg-encode-apis/.
  private encodeJpeg(canvas: HTMLCanvasElement, jpegQuality: number): string {
    return profiler.time('CurrentFrameVideoSource.encodeJpeg', () =>
      canvas.toDataURL('image/jpeg', jpegQuality),
    );
  }

  private createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  private clipToCanvas(region: VideoFrameRegion): VideoFrameRegion {
    const x = Math.max(0, Math.floor(region.x));
    const y = Math.max(0, Math.floor(region.y));
    const right = Math.min(this.canvas.width, Math.ceil(region.x + region.width));
    const bottom = Math.min(this.canvas.height, Math.ceil(region.y + region.height));
    return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
  }
}
