import type { GrayscaleFrame } from '@core/person-segmentation/domain/GrayscaleFrame';
import type { PoseFeatures } from '@core/person-segmentation/domain/PoseFeatures';
import type { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';
import type { FrameMotionCalculator } from '@core/person-segmentation/services/FrameMotionCalculator';
import type { GrayscaleDownscaler } from '@core/person-segmentation/services/GrayscaleDownscaler';
import type { LaplacianVarianceCalculator } from '@core/person-segmentation/services/LaplacianVarianceCalculator';
import type { PassingSample } from '@core/person-segmentation/domain/PassingSample';
import type { PersonBboxCalculator } from '@core/person-segmentation/services/PersonBboxCalculator';
import type { RunProfiler } from '@core/person-segmentation/domain/RunProfiler';
import type { PoseFeatureExtractor } from '@core/person-segmentation/services/PoseFeatureExtractor';
import type { DecodedVideoFrame, PrefetchingVideoFrameReader } from '@core/person-segmentation/services/PrefetchingVideoFrameReader';
import type { SamplePassEvaluator } from '@core/person-segmentation/services/SamplePassEvaluator';
import type { ShoulderDriftCalculator } from '@core/person-segmentation/services/ShoulderDriftCalculator';
import type { VideoFramePixelBuffer } from '@core/person-segmentation/services/VideoFramePixelBuffer';
import type { PersonSegmenterWorkerClient } from '@core/person-segmentation/infrastructure/PersonSegmenterWorkerClient';

interface PreviousSampleState {
  readonly grayscale: GrayscaleFrame | null;
  readonly features: PoseFeatures | null;
}

/** Sample timestamps in walk order, alongside the range each one belongs to. */
interface SamplePlan {
  readonly timestamps: ReadonlyArray<number>;
  readonly rangeIndexes: ReadonlyArray<number>;
}

/**
 * Walks the given ranges of a video at a fixed sample fps and reports,
 * per sample, whether that frame meets every scene-validity threshold
 * — a visible person of the required visibility, low frame motion, low
 * shoulder drift, and sharp enough content. Each sample runs pose
 * detection through the supplied worker client; blur and motion are
 * measured on the caller's downscaler.
 *
 * Samples come back raw rather than grouped into scenes: a scene can
 * run across two ranges walked at different times, and only a caller
 * holding every sample taken so far can see that.
 *
 * Progress is reported through `onFraction` as `[0, 1]` over the
 * samples planned. Aborting the supplied signal stops the walk at
 * the next sample and throws.
 */
export class SceneValidityScanner {

  constructor(
    private readonly frameReader: PrefetchingVideoFrameReader,
    private readonly pixelBuffer: VideoFramePixelBuffer,
    private readonly blurCalculator: LaplacianVarianceCalculator,
    private readonly motionCalculator: FrameMotionCalculator,
    private readonly poseExtractor: PoseFeatureExtractor,
    private readonly personBboxCalculator: PersonBboxCalculator,
    private readonly driftCalculator: ShoulderDriftCalculator,
    private readonly evaluator: SamplePassEvaluator,
    private readonly workerClient: PersonSegmenterWorkerClient,
    private readonly profiler: RunProfiler,
  ) {}

  async scan(
    video: HTMLVideoElement,
    downscaler: GrayscaleDownscaler,
    sampleFps: number,
    ranges: TimeRangeSet,
    signal: AbortSignal,
    onFraction: (fraction: number) => void,
  ): Promise<ReadonlyArray<PassingSample>> {
    const plan = this.planSamples(ranges, sampleFps);
    const samples: PassingSample[] = [];
    // Motion and shoulder drift are read against the previous sample,
    // which only means anything within one contiguous stretch: across
    // a gap the two frames are seconds apart and every shot reads as a
    // jump cut. Each range therefore starts from nothing.
    let previous: PreviousSampleState = { grayscale: null, features: null };
    let currentRangeIndex = -1;
    let sampled = 0;
    for await (const frame of this.frameReader.read(video, plan.timestamps, signal)) {
      const rangeIndex = plan.rangeIndexes[sampled]!;
      if (rangeIndex !== currentRangeIndex) {
        previous = { grayscale: null, features: null };
        currentRangeIndex = rangeIndex;
      }
      const evaluated = await this.sampleOne(frame, downscaler, previous);
      samples.push({ t: frame.timestamp, passes: evaluated.passes });
      previous = { grayscale: evaluated.grayscale, features: evaluated.features };
      sampled++;
      onFraction(sampled / plan.timestamps.length);
    }
    return samples;
  }

  private planSamples(ranges: TimeRangeSet, sampleFps: number): SamplePlan {
    const step = 1 / sampleFps;
    const timestamps: number[] = [];
    const rangeIndexes: number[] = [];
    ranges.list().forEach((range, rangeIndex) => {
      for (let timestamp = range.start; timestamp < range.end; timestamp += step) {
        timestamps.push(timestamp);
        rangeIndexes.push(rangeIndex);
      }
    });
    return { timestamps, rangeIndexes };
  }

  private async sampleOne(
    frame: DecodedVideoFrame,
    downscaler: GrayscaleDownscaler,
    previous: PreviousSampleState,
  ): Promise<{ passes: boolean; grayscale: GrayscaleFrame; features: PoseFeatures | null }> {
    // Held before the bitmap goes to the worker, which transfers it:
    // the person-blur crop is only known once the pose comes back.
    const pixels = this.profiler.measureSync('scan:hold-frame', () => this.pixelBuffer.hold(frame.bitmap));
    const fullGrayscale = this.profiler.measureSync('scan:downscale', () => downscaler.fullFrame(pixels));
    const features = await this.detectPose(frame);
    const personBlur = this.profiler.measureSync('scan:person-blur', () => this.measurePersonBlur(pixels, downscaler, features));
    const frameBlur = this.profiler.measureSync('scan:frame-blur', () => this.blurCalculator.fullFrame(fullGrayscale));
    const frameMotion = this.profiler.measureSync(
      'scan:motion',
      () => this.motionCalculator.meanAbsoluteDifference(fullGrayscale, previous.grayscale),
    );
    const drift = this.driftCalculator.percentBetween(features, previous.features, pixels.width, pixels.height);
    const passes = this.evaluator.passes({
      features,
      frameBlur,
      personBlur,
      frameMotion,
      shoulderDriftPercent: drift,
    });
    return { passes, grayscale: fullGrayscale, features };
  }

  private async detectPose(frame: DecodedVideoFrame): Promise<PoseFeatures | null> {
    const landmarks = await this.profiler.measure(
      'scan:pose-worker',
      () => this.workerClient.detectPose(frame.bitmap, Math.round(frame.timestamp * 1000)),
    );
    return this.poseExtractor.extract(landmarks);
  }

  private measurePersonBlur(
    pixels: OffscreenCanvas,
    downscaler: GrayscaleDownscaler,
    features: PoseFeatures | null,
  ): number {
    const bbox = this.personBboxCalculator.compute(features);
    if (bbox === null) return 0;
    const sourceX = bbox.minX * pixels.width;
    const sourceY = bbox.minY * pixels.height;
    const sourceWidth = (bbox.maxX - bbox.minX) * pixels.width;
    const sourceHeight = (bbox.maxY - bbox.minY) * pixels.height;
    const personGrayscale = downscaler.region(pixels, sourceX, sourceY, sourceWidth, sourceHeight);
    return this.blurCalculator.fullFrame(personGrayscale);
  }
}
