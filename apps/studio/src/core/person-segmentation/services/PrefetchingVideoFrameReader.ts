import type { RunProfiler } from '@core/person-segmentation/domain/RunProfiler';
import type { VideoFrameBitmapCapturer } from '@core/person-segmentation/services/VideoFrameBitmapCapturer';
import type { VideoFrameSeeker } from '@core/person-segmentation/services/VideoFrameSeeker';

export interface DecodedVideoFrame {
  readonly timestamp: number;
  readonly bitmap: ImageBitmap;
}

/**
 * Walks a video through a sequence of timestamps and yields one
 * decoded frame per timestamp, in order, with the next frame's seek
 * and capture already in flight while the caller works on the current
 * one. Timestamps are expected in increasing order.
 *
 * The overlap is the point: a caller that awaits an inference per
 * frame would otherwise leave the decoder idle for the length of every
 * inference, and the inference idle for the length of every seek. The
 * floor becomes the slower of the two rather than their sum.
 *
 * Each yielded bitmap belongs to the caller, which must consume or
 * close it; the reader closes only the frame it has prefetched and
 * never handed out. Aborting the signal stops the walk before the next
 * frame is yielded and throws, and a seek that cannot decode throws
 * the same way rather than leaving the walk waiting.
 *
 * Callers must take everything they need for a timestamp from the
 * yielded bitmap, never from the video element: by the time a frame is
 * in hand the element has already moved on to the next seek.
 */
export class PrefetchingVideoFrameReader {

  /**
   * @param profilerScope Prefix for the profiler step this reader
   *   records its blocked time under, so two walks of the same video
   *   stay apart in the breakdown.
   */
  constructor(
    private readonly seeker: VideoFrameSeeker,
    private readonly capturer: VideoFrameBitmapCapturer,
    private readonly profiler: RunProfiler,
    private readonly profilerScope: string,
  ) {}

  async *read(
    video: HTMLVideoElement,
    timestamps: ReadonlyArray<number>,
    signal: AbortSignal,
  ): AsyncGenerator<DecodedVideoFrame> {
    let prefetched: Promise<ImageBitmap> | null = null;
    try {
      for (let index = 0; index < timestamps.length; index++) {
        signal.throwIfAborted();
        const arriving = prefetched ?? this.frameAt(video, timestamps[index]!, signal);
        prefetched = null;
        // What the caller actually loses to decoding: whatever is left
        // of the next frame once the previous one's work is done. It
        // falls to nothing when the prefetch stays ahead.
        const bitmap = await this.profiler.measure(`${this.profilerScope}:frame-wait`, () => arriving);
        if (index + 1 < timestamps.length) prefetched = this.frameAt(video, timestamps[index + 1]!, signal);
        yield { timestamp: timestamps[index]!, bitmap };
      }
    } finally {
      await this.discard(prefetched);
    }
  }

  private async frameAt(video: HTMLVideoElement, timestamp: number, signal: AbortSignal): Promise<ImageBitmap> {
    await this.seeker.seekTo(video, timestamp, signal);
    return this.capturer.capture(video);
  }

  /**
   * Releases a frame nobody asked for. A prefetch that failed has
   * nothing to release, and its failure is not the one worth raising —
   * the walk is already ending on whatever brought it here.
   */
  private async discard(prefetched: Promise<ImageBitmap> | null): Promise<void> {
    if (prefetched === null) return;
    try {
      (await prefetched).close();
    } catch {
      // Nothing was decoded, so nothing is held.
    }
  }
}
