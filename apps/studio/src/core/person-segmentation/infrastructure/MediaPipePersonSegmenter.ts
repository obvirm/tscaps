import type { PersonSegmenter } from '@core/person-segmentation/domain/PersonSegmenter';
import type { PersonSegmentationOptions } from '@core/person-segmentation/domain/PersonSegmentationOptions';
import type { PersonSegmentationProgress } from '@core/person-segmentation/domain/PersonSegmentationProgress';
import { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';
import type { PersonSegmentationRunRanges } from '@core/person-segmentation/domain/PersonSegmentationRunRanges';
import { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import type { PersonSegmentationResultAssembler } from '@core/person-segmentation/services/PersonSegmentationResultAssembler';
import { GrayscaleDownscaler } from '@core/person-segmentation/services/GrayscaleDownscaler';
import type { RunProfiler } from '@core/person-segmentation/domain/RunProfiler';
import type { PersonMaskCapturer } from '@core/person-segmentation/infrastructure/PersonMaskCapturer';
import type { PersonSegmenterWorkerClient } from '@core/person-segmentation/infrastructure/PersonSegmenterWorkerClient';
import type { SceneValidityScanner } from '@core/person-segmentation/infrastructure/SceneValidityScanner';

/**
 * MediaPipe-backed implementation of the person-segmenter contract.
 * Discovers the scene-valid time windows of a video through pose
 * landmarking, then captures actor confidence masks inside those
 * windows through the selfie image segmenter. Both models run in the
 * injected worker client so main-thread rendering stays responsive.
 */
export class MediaPipePersonSegmenter implements PersonSegmenter {

  constructor(
    private readonly workerClient: PersonSegmenterWorkerClient,
    private readonly sceneScanner: SceneValidityScanner,
    private readonly maskCapturer: PersonMaskCapturer,
    private readonly assembler: PersonSegmentationResultAssembler,
    private readonly profiler: RunProfiler,
  ) {}

  async run(
    video: HTMLVideoElement,
    options: PersonSegmentationOptions,
    ranges: PersonSegmentationRunRanges,
    signal: AbortSignal,
    onProgress: (progress: PersonSegmentationProgress) => void,
  ): Promise<PersonSegmentationResult> {
    this.profiler.begin();
    let result = PersonSegmentationResult.nothingKnown(new MaskCache());
    try {
      if (ranges.toScan.isEmpty()) return result;
      await this.profiler.measure('worker:ensure-ready', () => this.workerClient.ensureReady(options.maskMaxSide));
      const downscaler = new GrayscaleDownscaler(options.downscaleWidth, options.downscaleHeight);
      const samples = await this.sceneScanner.scan(
        video,
        downscaler,
        options.sampleFps,
        ranges.toScan,
        signal,
        (fraction) => onProgress({ phase: 'scanning', fraction }),
      );
      const scanned = this.assembler.assemble(ranges.toScan, samples, new MaskCache());
      const maskCache = await this.maskCapturer.capture(
        video,
        TimeRangeSet.of(scanned.windows).intersectedWith(ranges.toCapture).list(),
        options.cacheFps,
        signal,
        (fraction) => onProgress({ phase: 'caching-masks', fraction }),
      );
      result = this.assembler.withMasks(scanned, maskCache);
      return result;
    } finally {
      this.profiler.report(`${this.describeRun(video, options)}\n  ${this.describeWindows(result)}`);
    }
  }

  private describeRun(video: HTMLVideoElement, options: PersonSegmentationOptions): string {
    const duration = Number.isFinite(video.duration) ? video.duration.toFixed(1) : '?';
    return `${duration} s of video at ${video.videoWidth}×${video.videoHeight}`
      + `, sampleFps ${options.sampleFps}, cacheFps ${options.cacheFps}`;
  }

  private describeWindows(result: PersonSegmentationResult): string {
    const analyzed = `analyzed ${result.analyzedRanges.totalSeconds().toFixed(1)} s`
      + ` over ${result.analyzedRanges.list().length} range(s)`;
    const windows = result.windows;
    if (windows.length === 0) return `${analyzed}, windows: none`;
    const durations = windows.map((window) => window.end - window.start).sort((a, b) => a - b);
    const covered = durations.reduce((total, duration) => total + duration, 0);
    return `${analyzed}, windows: ${windows.length} covering ${covered.toFixed(1)} s`
      + ` (shortest ${durations[0]!.toFixed(2)} s,`
      + ` median ${durations[Math.floor(durations.length / 2)]!.toFixed(2)} s,`
      + ` longest ${durations[durations.length - 1]!.toFixed(2)} s)`;
  }
}
