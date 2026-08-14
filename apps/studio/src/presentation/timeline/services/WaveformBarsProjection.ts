import type { WaveformScale } from '@presentation/timeline/services/WaveformScale';

/**
 * Projects a slice of raw audio peaks into a fixed-size bar-chart
 * shape. The projection answers three presentation concerns at once:
 * which peaks fall inside the requested time window, how to downsample
 * them so that a long window doesn't outrun the renderer with one bar
 * per peak, and how tall each surviving peak is drawn.
 *
 * The output is a bar height in `[0, 1]`. The consuming view decides
 * how to draw it (SVG path, canvas strokes, etc.).
 */
export class WaveformBarsProjection {

  constructor(private readonly targetBarCount: number = 300) {}

  /**
   * `scale` must be the one resolved for the whole recording, or
   * neighbouring windows stop being comparable.
   */
  bars(
    peaks: Float32Array,
    peaksPerSecond: number,
    startSec: number,
    endSec: number,
    scale: WaveformScale,
  ): Float32Array {
    const slice = this.sliceFor(peaks, peaksPerSecond, startSec, endSec);
    // Scaled after downsampling rather than before: the curve is
    // monotonic, so the loudest peak of a bucket is the loudest either
    // way, and this leaves one call per drawn bar instead of per peak.
    return this.scaled(this.downsample(slice, this.targetBarCount), scale);
  }

  private scaled(bars: Float32Array, scale: WaveformScale): Float32Array {
    const out = new Float32Array(bars.length);
    for (let i = 0; i < bars.length; i++) out[i] = scale.heightOf(bars[i]!);
    return out;
  }

  private sliceFor(
    peaks: Float32Array,
    peaksPerSecond: number,
    startSec: number,
    endSec: number,
  ): Float32Array {
    const startIndex = Math.max(0, Math.floor(startSec * peaksPerSecond));
    const endIndex = Math.min(peaks.length, Math.ceil(endSec * peaksPerSecond));
    if (endIndex <= startIndex) return new Float32Array(0);
    return peaks.subarray(startIndex, endIndex);
  }

  private downsample(slice: Float32Array, targetCount: number): Float32Array {
    if (slice.length <= targetCount) return slice;
    const stride = Math.ceil(slice.length / targetCount);
    const result = new Float32Array(Math.ceil(slice.length / stride));
    for (let i = 0; i < result.length; i++) {
      const start = i * stride;
      const end = Math.min(slice.length, start + stride);
      let peak = 0;
      for (let j = start; j < end; j++) {
        const abs = slice[j]!;
        if (abs > peak) peak = abs;
      }
      result[i] = peak;
    }
    return result;
  }
}
