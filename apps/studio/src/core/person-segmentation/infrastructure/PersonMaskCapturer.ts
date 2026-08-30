import { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';
import type { RunProfiler } from '@core/person-segmentation/domain/RunProfiler';
import type { PrefetchingVideoFrameReader } from '@core/person-segmentation/services/PrefetchingVideoFrameReader';
import type { PersonSegmenterWorkerClient } from '@core/person-segmentation/infrastructure/PersonSegmenterWorkerClient';

/**
 * Collects actor confidence masks across the given time ranges of a
 * video. Walks each range at a fixed capture fps, runs the supplied
 * worker client's person segmenter at every timestamp, and returns
 * the downsampled alpha bytes in a `MaskCache` keyed by time. Frames
 * arrive from a prefetching reader, so the next one decodes while the
 * segmenter works on the current.
 *
 * Progress is reported through `onFraction` as `[0, 1]` over the sum
 * of the given ranges' durations. An empty ranges list resolves
 * immediately with an empty cache. Aborting the supplied signal stops
 * the walk at the next sample and throws.
 */
export class PersonMaskCapturer {

  constructor(
    private readonly frameReader: PrefetchingVideoFrameReader,
    private readonly workerClient: PersonSegmenterWorkerClient,
    private readonly profiler: RunProfiler,
  ) {}

  async capture(
    video: HTMLVideoElement,
    ranges: ReadonlyArray<PersonSegmentationWindow>,
    cacheFps: number,
    signal: AbortSignal,
    onFraction: (fraction: number) => void,
  ): Promise<MaskCache> {
    return this.captureEach(video, this.timestampsAcross(ranges, cacheFps), signal, onFraction);
  }

  /**
   * Collects one mask per given timestamp, in the given order. The
   * timestamps must be strictly increasing. Progress is reported
   * through `onFraction` as `[0, 1]` over the timestamp count; an
   * empty list resolves immediately with an empty cache. Aborting the
   * supplied signal stops the walk at the next sample and throws.
   */
  async captureAtTimestamps(
    video: HTMLVideoElement,
    timestamps: ReadonlyArray<number>,
    signal: AbortSignal,
    onFraction: (fraction: number) => void,
  ): Promise<MaskCache> {
    this.profiler.begin();
    try {
      return await this.captureEach(video, timestamps, signal, onFraction);
    } finally {
      this.profiler.report(`segment backfill over ${timestamps.length} timestamps`);
    }
  }

  private async captureEach(
    video: HTMLVideoElement,
    timestamps: ReadonlyArray<number>,
    signal: AbortSignal,
    onFraction: (fraction: number) => void,
  ): Promise<MaskCache> {
    const cache = new MaskCache();
    if (timestamps.length === 0) {
      onFraction(1);
      return cache;
    }
    let captured = 0;
    for await (const frame of this.frameReader.read(video, timestamps, signal)) {
      const mask = await this.profiler.measure(
        'masks:segment-worker',
        () => this.workerClient.segmentPerson(frame.bitmap, Math.round(frame.timestamp * 1000), frame.timestamp),
      );
      cache.add(mask);
      captured++;
      onFraction(captured / timestamps.length);
    }
    return cache;
  }

  private timestampsAcross(ranges: ReadonlyArray<PersonSegmentationWindow>, cacheFps: number): number[] {
    const step = 1 / cacheFps;
    const timestamps: number[] = [];
    for (const range of ranges) {
      for (let timestamp = range.start; timestamp <= range.end; timestamp += step) timestamps.push(timestamp);
    }
    return timestamps;
  }
}
