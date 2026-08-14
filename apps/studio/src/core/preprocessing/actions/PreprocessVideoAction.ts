import { Document, Section, type TranscriberOptions } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { TranscribePreference } from '@core/transcription/domain/TranscribePreference';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { TranscribeAction } from '@core/transcription/actions/TranscribeAction';
import type { TranscriptionAudioLengthPolicy } from '@core/transcription/domain/TranscriptionAudioLengthPolicy';
import type { RunTaggersAction } from '@core/tagging/actions/RunTaggersAction';
import type { ApplyHookSheetAction } from '@core/preprocessing/actions/ApplyHookSheetAction';
import type { ApplyMultipleSpeakersAction } from '@core/preprocessing/actions/ApplyMultipleSpeakersAction';
import type { ApplyTextDirectionAction } from '@core/preprocessing/actions/ApplyTextDirectionAction';
import type { CreateProjectAction } from '@core/projects/actions/CreateProjectAction';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type { PreviewProxyProgressCallback } from '@core/preview/domain/PreviewProxyGenerator';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';
import type { PreviewProxyResolver } from '@core/preview/services/PreviewProxyResolver';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';
import type { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import type { ProxyTiming } from '@core/preprocessing/domain/ProxyTiming';
import type { TelemetryEventProperties } from '@shared/telemetry';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { VideoMetadataProbe } from '@core/videos/domain/VideoMetadataProbe';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';
import type { AppError } from '@core/errors/domain/AppError';
import type { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { StoragePersistence } from '@core/_shared/infrastructure/StoragePersistence';

type TelemetryPropertyBag = TelemetryEventProperties;

export interface PreprocessVideoOptions {
  readonly transcriber?: TranscriberOptions;
  readonly multipleSpeakers: boolean;
}

/**
 * Entry point for the editor's preprocessing pipeline over a freshly
 * loaded video: transcribes it, resolves the preview proxy, runs the
 * semantic taggers, derives the visible document, and persists the
 * project. Sets `status` and `error` on the editor store around the
 * run and emits `preprocessing_*` telemetry per phase.
 *
 * Persistence is gated by the supplied `canPersist` callback. Asking
 * the browser to keep this origin's storage is not: the run writes
 * evictable data whether or not the project is allowed to be saved.
 */
export class PreprocessVideoAction {
  constructor(
    private readonly store: EditorStore,
    private readonly transcribe: TranscribeAction,
    private readonly runTaggers: RunTaggersAction,
    private readonly applyHookSheet: ApplyHookSheetAction,
    private readonly applyMultipleSpeakers: ApplyMultipleSpeakersAction,
    private readonly applyTextDirection: ApplyTextDirectionAction,
    private readonly refresh: RefreshDocumentAction,
    private readonly createProject: CreateProjectAction,
    private readonly saveProject: SaveProjectAction,
    private readonly previewProxyResolver: PreviewProxyResolver,
    private readonly proxyRepository: PreviewProxyRepository,
    private readonly compatibilityChecker: VideoCompatibilityChecker,
    private readonly audioLengthPolicy: TranscriptionAudioLengthPolicy,
    private readonly progressStore: PreprocessingProgressStore,
    private readonly proxyTiming: ProxyTiming,
    private readonly previewProxyEnabled: boolean,
    private readonly canPersist: () => boolean,
    private readonly surfaceLabel: string,
    private readonly telemetry: Telemetry,
    private readonly metadataProbe: VideoMetadataProbe,
    private readonly errorClassifier: AppErrorClassifier,
    private readonly errorTelemetryDescriber: AppErrorTelemetryDescriber,
    private readonly saveFailureReporter: NonBlockingFailureReporter,
    private readonly storagePersistence: StoragePersistence,
  ) {}

  async execute(options: PreprocessVideoOptions): Promise<void> {
    const { video, transcribePreference } = this.store.snapshot();
    const videoFile = video.file;
    if (!videoFile) return;

    const metadata = await this.probeSourceMetadata(videoFile);
    const capCheckError = this.rejectionIfOverCap(metadata?.durationSeconds ?? video.duration);
    if (capCheckError) {
      this.store.patch({ error: capCheckError });
      return;
    }

    // Everything from here on writes something the browser is free to
    // throw away later: the transcription model, the preview proxy,
    // the project itself. Asking at this point ties the prompt that
    // some browsers show to an action the person just took, which a
    // request at page load could never do.
    void this.storagePersistence.ensure();

    this.store.patch({ status: 'preprocessing', error: null });
    await this.yieldOnePaint();
    this.applyOriginalVideoLayout(metadata);
    const startedAt = performance.now();
    this.telemetry.capture('preprocessing_started', {
      ...this.baseProperties(videoFile),
      ...this.metadataProperties(metadata),
    });

    const initialPersist = this.establishAndPersistInitial();
    // Nothing awaits this until the pipeline is done, which can be
    // minutes away. Without a handler attached now, an early failure
    // is an unhandled rejection; `persistResult` still sees it.
    initialPersist.catch(() => undefined);

    try {
      await this.compatibilityChecker.check(videoFile);
      const transcribeInFlight = this.resolveTranscription(
        videoFile,
        transcribePreference,
        options.transcriber,
        metadata,
      );
      const freshProxy = await this.runPreviewProxy(videoFile, transcribeInFlight);
      const transcribed = await transcribeInFlight;
      this.store.patch({ document: transcribed });
      await this.runTaggers.execute();
      this.applyHookSheet.execute();
      this.applyMultipleSpeakers.execute(options.multipleSpeakers);
      this.applyTextDirection.execute();
      this.refresh.execute();
      const persisted = await this.persistResult(initialPersist);
      if (persisted && freshProxy) this.dispatchProxyStore(freshProxy);
      this.progressStore.markComplete();
      this.telemetry.capture('preprocessing_completed', {
        ...this.baseProperties(videoFile),
        ...this.metadataProperties(metadata),
        elapsed_ms: Math.round(performance.now() - startedAt),
      });
    } catch (err) {
      this.handleFailure(err, videoFile, metadata, Math.round(performance.now() - startedAt));
    }
  }

  /**
   * Publishes the preview proxy in step with the transcribe run.
   * Returns the freshly generated proxy so the caller may persist it
   * once the project row is durable, or `null` when a cached proxy
   * was reused or the pipeline is disabled.
   *
   * A transcribe failure short-circuits this method so the error
   * surfaces immediately instead of waiting for the proxy encoder to
   * finish — the encoder can take minutes and the visitor sees the
   * splash frozen until it does. The orphaned encoding is left to
   * settle in the background; its rejection is caught so it does not
   * bubble up as an unhandled promise.
   *
   * Timing is tuned to the active surface via `proxyTiming`:
   *
   * - `parallel-with-transcribe`: starts encoding once the transcriber
   *   leaves its audio-extract phase, so proxy I/O over the source
   *   does not compete with audio extraction. Encoding then runs
   *   alongside the transcribe HTTP roundtrip.
   * - `sequential-after-transcribe`: waits for transcribe to finish
   *   before encoding — used when transcribe runs a browser-side
   *   worker that would compete with the encoder for the CPU.
   */
  private async runPreviewProxy(
    source: Blob,
    transcribeInFlight: Promise<Document>,
  ): Promise<PreviewProxy | null> {
    if (!this.previewProxyEnabled) {
      this.publishPreviewFile(source, false);
      return null;
    }
    const reportProgress = (progress: number) => this.progressStore.setPreviewProxyProgress(progress);
    const generation = this.encodePreviewProxyAtScheduledMoment(source, transcribeInFlight, reportProgress);
    generation.catch(() => undefined);
    await transcribeInFlight;
    this.progressStore.enterPreviewProxyPhase();
    return generation;
  }

  private async encodePreviewProxyAtScheduledMoment(
    source: Blob,
    transcribeInFlight: Promise<Document>,
    reportProgress: PreviewProxyProgressCallback,
  ): Promise<PreviewProxy | null> {
    await this.waitForProxyStartMoment(transcribeInFlight);
    return this.resolveAndPublishPreviewProxy(source, reportProgress);
  }

  private waitForProxyStartMoment(transcribeInFlight: Promise<Document>): Promise<void> {
    if (this.proxyTiming === 'parallel-with-transcribe') {
      return this.waitForAudioExtractToFinish(transcribeInFlight);
    }
    return this.settleTranscribe(transcribeInFlight);
  }

  private async resolveAndPublishPreviewProxy(
    source: Blob,
    onProgress: PreviewProxyProgressCallback,
  ): Promise<PreviewProxy | null> {
    const resolution = await this.previewProxyResolver.fromSource(source, onProgress);
    this.publishPreviewFile(resolution.previewBlob, resolution.freshProxy !== null);
    return resolution.freshProxy;
  }

  private publishPreviewFile(blob: Blob, isProxy: boolean): void {
    this.store.patchVideo({ previewFile: blob, previewIsProxy: isProxy });
  }

  /**
   * Resolves once the progress store reports the audio-extract phase
   * is past — covers transcribers that emit a later phase (e.g. one
   * that moves into `inferring`) and transcribers that never went
   * through audio-extract at all. Also resolves when the transcribe
   * promise settles for any other reason, so a failure before the
   * phase advances does not leave the pipeline waiting forever.
   */
  private waitForAudioExtractToFinish(transcribeInFlight: Promise<Document>): Promise<void> {
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.progressStore.removeEventListener('change', onPhaseChange);
        resolve();
      };
      const onPhaseChange = () => {
        if (this.progressStore.isPhasePast('audio-extract')) finish();
      };
      this.progressStore.addEventListener('change', onPhaseChange);
      onPhaseChange();
      void transcribeInFlight.then(finish, finish);
    });
  }

  private settleTranscribe(transcribeInFlight: Promise<Document>): Promise<void> {
    return transcribeInFlight.then(
      () => undefined,
      () => undefined,
    );
  }

  /**
   * Starts the real transcription, or resolves immediately with an
   * empty document when the source is known to carry no audio track —
   * there is no speech to transcribe, and the transcriber would only
   * fail trying to extract audio. The rest of the pipeline runs as
   * usual so the editor opens and captions can be written by hand.
   */
  private resolveTranscription(
    videoFile: File,
    preference: TranscribePreference,
    transcriber: TranscriberOptions | undefined,
    metadata: VideoSourceMetadata | null,
  ): Promise<Document> {
    if (metadata?.hasAudioTrack === false) {
      return Promise.resolve(new Document({ sections: [new Section({ segments: [], kind: '' })] }));
    }
    return this.transcribe.execute(videoFile, preference, transcriber);
  }

  /**
   * Rides on every phase of the run, not just the failing one, so a
   * failure count can be read against how often that configuration is
   * chosen at all.
   *
   * The transcribe settings describe the on-device speech model, whose
   * weights are a large first-use download and the part most likely to
   * fail; they are inert on surfaces that transcribe remotely, which
   * the `surface` tag already separates.
   */
  private baseProperties(videoFile: File): TelemetryPropertyBag {
    const { transcribePreference } = this.store.snapshot();
    return {
      surface: this.surfaceLabel,
      video_size_mb: this.videoSizeMb(videoFile),
      transcribe_model: transcribePreference.model,
      transcribe_backend: transcribePreference.backend,
    };
  }

  private videoSizeMb(videoFile: File): number {
    return Math.round((videoFile.size / (1024 * 1024)) * 10) / 10;
  }

  /**
   * Runs the cap check on the freshly probed duration before any side
   * effect and returns the wrapped rejection when the video is over
   * the cap, or `null` when it fits. Called first inside `execute` so
   * a rejected attempt never patches `status`, never emits telemetry,
   * and never opens an HTTP round-trip to the project backend.
   */
  private rejectionIfOverCap(durationSeconds: number): AppError | null {
    try {
      this.audioLengthPolicy.enforce(durationSeconds);
      return null;
    } catch (err) {
      return this.errorClassifier.wrap(err);
    }
  }

  // Let the browser paint the splash before the heavy work starts.
  private async yieldOnePaint(): Promise<void> {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  private async probeSourceMetadata(videoFile: File): Promise<VideoSourceMetadata | null> {
    try {
      return await this.metadataProbe.probe(videoFile);
    } catch (err) {
      console.warn('[preprocess] metadata probe failed', err);
      return null;
    }
  }

  /**
   * Stamps `video.layout` with the source's true pixel dimensions.
   * The preview surface later loads a downscaled proxy whose
   * intrinsic size would otherwise overwrite this field and steer
   * export at the proxy resolution instead of the source's.
   */
  private applyOriginalVideoLayout(metadata: VideoSourceMetadata | null): void {
    if (!metadata) return;
    if (metadata.videoWidthPx === null || metadata.videoHeightPx === null) return;
    this.store.setVideoLayout({ width: metadata.videoWidthPx, height: metadata.videoHeightPx });
  }

  private metadataProperties(metadata: VideoSourceMetadata | null): TelemetryPropertyBag {
    if (!metadata) return {};
    return {
      mime_type: metadata.mimeType,
      container_format: metadata.containerFormat,
      duration_s: metadata.durationSeconds,
      video_codec: metadata.videoCodec,
      has_audio_track: metadata.hasAudioTrack,
      audio_codec: metadata.audioCodec,
      audio_sample_rate: metadata.audioSampleRate,
      audio_channels: metadata.audioChannels,
    };
  }

  /**
   * Stamps a fresh project identity (if needed) and kicks off the
   * first save in the background so it can run in parallel with the
   * transcription work. Awaited by `persistResult` later. No-op when
   * persistence is forbidden.
   */
  private async establishAndPersistInitial(): Promise<void> {
    if (!this.canPersist()) return;
    if (this.store.snapshot().projectId === null) {
      await this.createProject.execute();
    }
    await this.saveProject.execute();
  }

  /**
   * Awaits the initial-save background promise, then writes the
   * project again so the transcribed and tagged document lands in a
   * single payload. Resolves to `true` when the project row is
   * durable, `false` when persistence was skipped or either save
   * failed. A save failure is reported without interrupting: the
   * document is finished and usable, and the editor opening is worth
   * more than a modal about bytes that did not reach disk.
   */
  private async persistResult(initialPersist: Promise<void>): Promise<boolean> {
    if (!this.canPersist()) return false;
    try {
      await initialPersist;
      await this.saveProject.execute();
      return true;
    } catch (cause) {
      console.error('[preprocess] auto-save after pipeline failed', cause);
      this.saveFailureReporter.report(cause);
      return false;
    }
  }

  /**
   * Fires the proxy persistence in the background. The editor is
   * already playing the freshly generated proxy locally; a failure
   * to durably store it only impacts the next open of this project.
   */
  private dispatchProxyStore(proxy: PreviewProxy): void {
    const projectId = this.store.snapshot().projectId;
    if (projectId === null) return;
    void this.proxyRepository.store(projectId, proxy).catch((error) => {
      console.error('[preprocess] preview-proxy store failed', error);
    });
  }

  private handleFailure(
    err: unknown,
    videoFile: File,
    metadata: VideoSourceMetadata | null,
    elapsedMs: number,
  ): void {
    console.error('[preprocess] failed', err);
    const appError = this.errorClassifier.wrap(err);
    this.store.patch({ status: 'idle', error: appError });
    this.telemetry.capture('preprocessing_failed', {
      ...this.baseProperties(videoFile),
      ...this.metadataProperties(metadata),
      ...this.errorTelemetryDescriber.describe(appError),
      elapsed_ms: elapsedMs,
    });
  }
}
