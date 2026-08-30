import type { VideoRenderer, OutputFormat, RenderQuality, AudioDiscardReason, VideoFrameDecoderSelection } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { FileDownloader } from '@core/_shared/domain/FileDownloader';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ExportPauseCoordinator } from '@core/export/services/ExportPauseCoordinator';
import type { ExportWriter } from '@core/export/domain/ExportWriter';
import type { ExportWriterFactory } from '@core/export/domain/ExportWriterFactory';
import type { ExportProgressStore } from '@core/export/store/ExportProgressStore';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { ExportRenderPlan, ExportRenderPlanner } from '@core/export/services/ExportRenderPlanner';
import type { OriginalVideoDownloadStore } from '@core/projects/store/OriginalVideoDownloadStore';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryEventProperties } from '@shared/telemetry';
import type { SheetCustomizationDiff } from '@core/sheets/services/SheetCustomizationDiff';
import type { VisibilitySpan, VisibilityTracker } from '@core/_shared/domain/VisibilityTracker';
import { AppError } from '@core/errors/domain/AppError';
import { ExportFailedError } from '@core/export/domain/ExportFailedError';

/**
 * Target output dimensions chosen by the user. `'original'` means
 * "keep the source resolution"; an explicit `{ width, height }` value
 * triggers a downscale in the renderer (it never upscales beyond the
 * source).
 */
export type ExportResolution = 'original' | { width: number; height: number };

export interface ExportVideoOptions {
  format: OutputFormat;
  quality: RenderQuality;
  resolution: ExportResolution;
}

/**
 * Runs one export from the editor: plans what to burn, opens a writer,
 * drives the renderer into it, hands the finished file to the user, and
 * reports the outcome.
 *
 * What gets burned is the planner's answer — this action owns the run,
 * not the picture. Named *VideoAction* to disambiguate from
 * `ExportProjectAction` (which exports the project metadata as a
 * `.tscaps` file).
 */
export class ExportVideoAction {

  constructor(
    private readonly editorStore: EditorStore,
    private readonly exportStore: ExportStore,
    private readonly downloadStore: OriginalVideoDownloadStore,
    private readonly renderer: VideoRenderer,
    private readonly planner: ExportRenderPlanner,
    private readonly exportPauseCoordinator: ExportPauseCoordinator,
    private readonly exportWriterFactory: ExportWriterFactory,
    private readonly fileDownloader: FileDownloader,
    private readonly progressStore: ExportProgressStore,
    private readonly saveProject: SaveProjectAction,
    private readonly telemetry: Telemetry,
    private readonly saveFailureReporter: NonBlockingFailureReporter,
    private readonly errorTelemetryDescriber: AppErrorTelemetryDescriber,
    private readonly customizationDiff: SheetCustomizationDiff,
    private readonly visibilityTracker: VisibilityTracker,
  ) {}

  async execute(options: ExportVideoOptions): Promise<void> {
    const { video, document, sheets, projectId, behindActorOverrides, elementStyles, decorationOverrides, cuts } = this.editorStore.snapshot();
    if (!document || sheets.length === 0 || video.fileName === null) return;

    const plan = await this.planner.plan({
      document,
      sheets,
      elementStyles,
      decorationOverrides,
      cuts,
      behindActorOverrides,
      projectId,
      videoLayout: video.layout,
    });

    // Open the writer before the heavy work: if the user cancels an
    // interactive prompt we abort without spending any encoding time.
    const writer = await this.openWriter(options.format);
    if (!writer) return;

    this.progressStore.reset();
    this.exportStore.start(video.file !== null ? 'rendering' : 'awaiting-original');
    this.editorStore.patch({ error: null });

    void this.persistAlongsideRender();

    await this.runRender(plan, options, writer, sheets);
  }

  private async runRender(
    plan: ExportRenderPlan,
    options: ExportVideoOptions,
    writer: ExportWriter,
    sheets: readonly Sheet[],
  ): Promise<void> {
    let audioDiscardedReason: AudioDiscardReason | null = null;
    let decoderSelection: VideoFrameDecoderSelection | null = null;
    console.time('[export] total');
    const startedAt = performance.now();
    const visibilitySpan = this.visibilityTracker.begin();
    this.telemetry.capture('export_started', {
      format: options.format,
      quality: options.quality,
      resolution: this.describeResolution(options.resolution),
    });
    this.captureTemplateUsageAtExport(sheets);
    try {
      const videoFile = await this.resolveOriginalVideoFile(this.editorStore.snapshot().video.file);
      await this.renderer.render(
        {
          video: videoFile,
          document: plan.document,
          styles: plan.styles,
          ...(plan.overlayHtml ? { overlayHtml: plan.overlayHtml } : {}),
          ...(plan.topLayer ? { topLayer: plan.topLayer } : {}),
          outputFormat: options.format,
          quality: options.quality,
          ...(options.resolution !== 'original' ? { outputResolution: options.resolution } : {}),
          outputStream: writer.stream(),
          ...(plan.skipRanges.length === 0 ? {} : { skipRanges: plan.skipRanges }),
          confirmFallbackDecoder: (info) => this.exportPauseCoordinator.pauseAndAwait({
            kind: 'fallback-decoder',
            codec: info.inputCodec,
          }),
          onAudioDiscarded: (reason) => { audioDiscardedReason = reason; },
          onVideoFrameDecoderSelected: (selection) => { decoderSelection = selection; },
        },
        (p) => this.updateProgress(p.percent),
      );

      const file = await writer.finalize();
      if (file) this.triggerDownload(file, options.format);

      this.exportStore.finish(
        audioDiscardedReason !== null
          ? { kind: 'audio-discarded', reason: audioDiscardedReason }
          : null,
      );
      this.telemetry.capture('export_completed', this.buildCompletedProperties({
        options,
        startedAt,
        audioDiscardedReason,
        decoderSelection,
        sheets,
      }));
    } catch (err) {
      await writer.abort();
      const elapsedMs = Math.round(performance.now() - startedAt);
      if (this.isCancellation(err)) {
        this.reportCancellation(options, elapsedMs);
      } else {
        this.reportFailure(err, options, elapsedMs, visibilitySpan, decoderSelection);
      }
    } finally {
      visibilitySpan.end();
      console.timeEnd('[export] total');
      writer.dispose();
    }
  }

  private isCancellation(err: unknown): boolean {
    return err instanceof Error && err.name === 'AbortError';
  }

  private reportCancellation(options: ExportVideoOptions, elapsedMs: number): void {
    // Write the cleared error before flipping the export state so
    // subscribers that react to the run-ending edge see the fresh
    // slot when they snapshot the editor.
    this.editorStore.patch({ error: null });
    this.exportStore.finish(null);
    this.telemetry.capture('export_cancelled', {
      format: options.format,
      quality: options.quality,
      resolution: this.describeResolution(options.resolution),
      elapsed_ms: elapsedMs,
    });
  }

  private reportFailure(
    err: unknown,
    options: ExportVideoOptions,
    elapsedMs: number,
    visibilitySpan: VisibilitySpan,
    decoderSelection: VideoFrameDecoderSelection | null,
  ): void {
    const appError = this.asExportError(err);
    this.editorStore.patch({ error: appError });
    this.exportStore.finish(null);
    this.telemetry.capture('export_failed', {
      format: options.format,
      quality: options.quality,
      resolution: this.describeResolution(options.resolution),
      elapsed_ms: elapsedMs,
      progress_percent: this.progressStore.percent,
      was_hidden: visibilitySpan.wasHidden,
      visibility_state: visibilitySpan.currentState,
      ...this.sourceProperties(),
      ...this.decoderProperties(decoderSelection),
      ...this.errorTelemetryDescriber.describe(appError),
    });
  }

  private buildCompletedProperties(inputs: {
    options: ExportVideoOptions;
    startedAt: number;
    audioDiscardedReason: AudioDiscardReason | null;
    decoderSelection: VideoFrameDecoderSelection | null;
    sheets: readonly Sheet[];
  }): TelemetryEventProperties {
    const { cuts, elementStyles } = this.editorStore.snapshot();
    return {
      format: inputs.options.format,
      quality: inputs.options.quality,
      resolution: this.describeResolution(inputs.options.resolution),
      elapsed_ms: Math.round(performance.now() - inputs.startedAt),
      audio_discarded: inputs.audioDiscardedReason !== null,
      ...this.sourceProperties(),
      ...this.decoderProperties(inputs.decoderSelection),
      sheet_count: inputs.sheets.length,
      total_customized_count: this.totalCustomizedCount(inputs.sheets),
      has_cuts: !cuts.isEmpty(),
      has_element_styles: !elementStyles.isEmpty(),
    };
  }

  /**
   * Describes the decoder the render ran through. Both fields are
   * `null` when the run ended before a decoder was chosen, which is
   * what tells an early failure apart from a decode-time one.
   */
  private decoderProperties(selection: VideoFrameDecoderSelection | null): TelemetryEventProperties {
    return {
      video_decoder: selection?.kind ?? null,
      video_codec: selection?.inputCodec ?? null,
    };
  }

  private sourceProperties(): TelemetryEventProperties {
    const { video } = this.editorStore.snapshot();
    return {
      source_width: video.layout?.width ?? null,
      source_height: video.layout?.height ?? null,
      source_duration_s: video.duration,
      source_size_mb: video.file ? this.videoSizeInMegabytes(video.file) : null,
    };
  }

  private videoSizeInMegabytes(videoFile: File): number {
    return Math.round((videoFile.size / (1024 * 1024)) * 10) / 10;
  }

  private totalCustomizedCount(sheets: readonly Sheet[]): number {
    let count = 0;
    for (const sheet of sheets) count += this.customizationDiff.diff(sheet).length;
    return count;
  }

  private describeResolution(resolution: ExportResolution): string {
    if (resolution === 'original') return 'original';
    return `${resolution.width}x${resolution.height}`;
  }

  /**
   * Emits one telemetry event per sheet describing how the user has
   * customized the template that sheet uses. Fires at the start of an
   * export so the snapshot reflects what is actually being rendered,
   * not intermediate state the user explored and reverted.
   */
  private captureTemplateUsageAtExport(sheets: readonly Sheet[]): void {
    for (const sheet of sheets) {
      const customized = this.customizationDiff.diff(sheet);
      this.telemetry.capture('template_used_at_export', {
        template_id: sheet.template.metadata.id,
        template_category: sheet.template.metadata.category,
        customized_properties: [...customized],
        customized_count: customized.length,
      });
    }
  }

  private updateProgress(percent: number): void {
    this.progressStore.setPercent(percent);
  }

  /**
   * Resolves the original-video bytes a render needs. When the editor
   * already has them, returns immediately. When the project's original
   * is still streaming in, waits for the download to finish and
   * advances the active export into the rendering phase before
   * returning the freshly published file.
   *
   * Rejects when the download settles in a failed state — the caller's
   * surrounding try/catch turns that into the standard export-failure
   * surfacing.
   */
  private async resolveOriginalVideoFile(initial: File | null): Promise<File> {
    if (initial !== null) return initial;
    await this.downloadStore.waitUntilReady();
    this.exportStore.enterRenderingPhase();
    const file = this.editorStore.snapshot().video.file;
    if (file === null) {
      throw new ExportFailedError({ cause: new Error('Original video bytes are still missing after the download reported ready') });
    }
    return file;
  }

  /**
   * Checkpoints the project so a render that crashes the tab does not
   * take the session's edits with it. Runs alongside the render rather
   * than ahead of it: how long the write takes depends on the storage
   * behind it, and the user asked for an export, not for a save — the
   * export must not sit behind a write of unbounded duration. Never
   * rejects.
   */
  private async persistAlongsideRender(): Promise<void> {
    try {
      await this.saveProject.execute();
    } catch (cause) {
      // Best-effort: a save failure here must not interrupt an export the
      // user already committed to, and must not land in the editor's
      // error slot, which is what the export itself reports through.
      console.error('[export] auto-save alongside render failed', cause);
      this.saveFailureReporter.report(cause);
    }
  }

  private asExportError(err: unknown): AppError {
    return err instanceof AppError ? err : new ExportFailedError({ cause: err });
  }

  /**
   * Builds and opens the writer for this export. Returns `null` when the
   * writer rejects with `AbortError` (the user dismissed an interactive
   * prompt) so the caller can abort without spending any encoding time.
   */
  private async openWriter(format: OutputFormat): Promise<ExportWriter | null> {
    const writer = this.exportWriterFactory.create();
    try {
      await writer.open(format);
      return writer;
    } catch (err) {
      writer.dispose();
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }

  private triggerDownload(blob: Blob, format: OutputFormat): void {
    this.fileDownloader.download(blob, `subtitled.${format}`);
  }
}
