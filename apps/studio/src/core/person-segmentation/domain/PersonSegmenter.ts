import type { PersonSegmentationOptions } from '@core/person-segmentation/domain/PersonSegmentationOptions';
import type { PersonSegmentationProgress } from '@core/person-segmentation/domain/PersonSegmentationProgress';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import type { PersonSegmentationRunRanges } from '@core/person-segmentation/domain/PersonSegmentationRunRanges';

/**
 * Contract for the pipeline that scans a video, produces the
 * scene-valid time windows for the text-behind-actor effect, and
 * captures per-frame masks inside those windows. Implementations are
 * responsible for cancellation via the supplied `AbortSignal` and for
 * emitting progress events as the run advances.
 */
export interface PersonSegmenter {
  /**
   * Runs the detector over the parts of `video` named by `ranges`,
   * and only those: every instant outside `toScan` is reported as no
   * scene, and every instant outside `toCapture` carries no mask. An
   * empty `toScan` is a complete answer — there is nothing to measure
   * — and resolves without decoding a frame.
   *
   * The video element must be loaded (metadata + first frame) before
   * the call. Rejects with an `AbortError` when `signal` fires; the
   * cancellation is cooperative — the returned promise resolves once
   * the current sample is processed. Progress events fire for each
   * sample or cached mask, so callers can drive a UI without polling.
   */
  run(
    video: HTMLVideoElement,
    options: PersonSegmentationOptions,
    ranges: PersonSegmentationRunRanges,
    signal: AbortSignal,
    onProgress: (progress: PersonSegmentationProgress) => void,
  ): Promise<PersonSegmentationResult>;
}
