import type { Document, DecorationPlacementSide, VideoRenderer, SubtitleStyle, OutputFormat, RenderQuality, ScopedRenderOverride, AudioDiscardReason, TopLayerSource } from '@tscaps/engine';
import { ElementRenderOverrides, SvgFilterBundle } from '@tscaps/engine';
import { SheetSvgFilterScopeProvider } from '@core/sheets/services/SheetSvgFilterScopeProvider';
import type { SheetSvgFilterDefinitionsResolver } from '@core/sheets/services/SheetSvgFilterDefinitionsResolver';
import type { FileDownloader } from '@core/_shared/domain/FileDownloader';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { BehindActorSegmentOverrideRegistry } from '@core/person-segmentation/domain/BehindActorSegmentOverrideRegistry';
import type { DecorationFilter } from '@core/captions/services/DecorationFilter';
import type { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import type { DecorationPlacementResolver } from '@core/effect/services/DecorationPlacementResolver';
import type { SheetCssVarsBuilder } from '@core/sheets/services/SheetCssVarsBuilder';
import type { LayeredCaptionCssBuilder } from '@core/captions/services/LayeredCaptionCssBuilder';
import type { CaptionFontOverridesBuilder } from '@core/fonts/services/CaptionFontOverridesBuilder';
import type { SegmentColorRotation } from '@core/sheets/services/SegmentColorRotation';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { FontFaceCssBuilder } from '@core/fonts/services/FontFaceCssBuilder';
import type { SheetFontFamilyCollector } from '@core/fonts/services/SheetFontFamilyCollector';
import type { DocumentUsedCodepointCollector } from '@core/fonts/services/DocumentUsedCodepointCollector';
import type { ExportPauseCoordinator } from '@core/export/services/ExportPauseCoordinator';
import type { ExportWriter } from '@core/export/domain/ExportWriter';
import type { ExportWriterFactory } from '@core/export/domain/ExportWriterFactory';
import type { ExportProgressStore } from '@core/export/store/ExportProgressStore';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { OriginalVideoDownloadStore } from '@core/projects/store/OriginalVideoDownloadStore';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryEventProperties } from '@shared/telemetry';
import type { ExportRenderContribution, ExportRenderContributor } from '@core/export/domain/ExportRenderContributor';
import type { SheetCustomizationDiff } from '@core/sheets/services/SheetCustomizationDiff';
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

export interface ExportOverlayHtmlContext {
  readonly projectId: string | null;
  readonly videoWidth: number;
  readonly videoHeight: number;
}

export type ExportOverlayHtmlProvider = (context: ExportOverlayHtmlContext) => string | null;

/**
 * Burns subtitles into the video. Each Sheet is mapped to a `SubtitleStyle`
 * keyed by sheet id; the renderer dispatches per-frame to the entry
 * matching the active Section's `kind`.
 *
 * The export SVG runs in an isolated CSS context that can't see the host
 * page's stylesheets, so for each sheet the action looks up the font
 * family it uses, asks the `FontFaceCssReader` for the matching
 * `@font-face` declarations, and prepends those to the sheet's own CSS —
 * the engine's renderer then inlines the referenced woff2 files as data
 * URIs.
 *
 * Named *VideoAction* to disambiguate from `ExportProjectAction` (which
 * exports the project metadata as a `.tscaps` file).
 */
export class ExportVideoAction {

  constructor(
    private readonly editorStore: EditorStore,
    private readonly exportStore: ExportStore,
    private readonly downloadStore: OriginalVideoDownloadStore,
    private readonly renderer: VideoRenderer,
    private readonly sheetCssVarsBuilder: SheetCssVarsBuilder,
    private readonly layeredCaptionCssBuilder: LayeredCaptionCssBuilder,
    private readonly captionFontOverridesBuilder: CaptionFontOverridesBuilder,
    private readonly segmentColorRotation: SegmentColorRotation,
    private readonly fontFaceCssBuilder: FontFaceCssBuilder,
    private readonly sheetFontFamilyCollector: SheetFontFamilyCollector,
    private readonly documentUsedCodepointCollector: DocumentUsedCodepointCollector,
    private readonly svgFilterDefinitionsResolver: SheetSvgFilterDefinitionsResolver,
    private readonly decorationPlacementResolver: DecorationPlacementResolver,
    private readonly decorationFilter: DecorationFilter,
    private readonly cutAwareDocumentBuilder: CutAwareDocumentBuilder,
    private readonly exportPauseCoordinator: ExportPauseCoordinator,
    private readonly exportWriterFactory: ExportWriterFactory,
    private readonly fileDownloader: FileDownloader,
    private readonly progressStore: ExportProgressStore,
    private readonly saveProject: SaveProjectAction,
    private readonly telemetry: Telemetry,
    private readonly saveFailureReporter: NonBlockingFailureReporter,
    private readonly errorTelemetryDescriber: AppErrorTelemetryDescriber,
    private readonly customizationDiff: SheetCustomizationDiff,
    private readonly renderContributors: ReadonlyArray<ExportRenderContributor>,
    private readonly overlayHtmlProvider?: ExportOverlayHtmlProvider,
  ) {}

  async execute(options: ExportVideoOptions): Promise<void> {
    const { video, document: subtitleDoc, sheets, projectId, behindActorOverrides, elementStyles, decorationOverrides, cuts } = this.editorStore.snapshot();
    const videoLayout = video.layout;
    if (!subtitleDoc || sheets.length === 0 || video.fileName === null) return;

    const visibleDoc = this.cutAwareDocumentBuilder.build(subtitleDoc, cuts);
    const renderDoc = this.decorationFilter.filterDocument(visibleDoc, sheets, decorationOverrides);
    const fontOverrides = this.captionFontOverridesBuilder.build(renderDoc, sheets, elementStyles);
    const wordOverridesBySheet = this.collectWordPlacements(renderDoc, elementStyles);
    const decorationPlacementsBySheet = this.collectDecorationPlacements(renderDoc, sheets);
    const usedCodepoints = this.documentUsedCodepointCollector.collect(renderDoc);
    const contribution = await this.prepareRenderContribution(renderDoc, sheets, behindActorOverrides, projectId);

    const styles: Record<string, SubtitleStyle> = {};
    for (const sheet of sheets) {
      const inlineStyles = this.sheetCssVarsBuilder.build(sheet);
      const sheetCss = sheet.resolveCss();
      const families = this.sheetFontFamilyCollector.collect({
        sheet,
        document: subtitleDoc,
        inlineStyles,
        sheetCss,
        elementStyles,
      });
      const fontFaces = this.fontFaceCssBuilder.build(families, usedCodepoints);
      const layeredCss = this.layeredCaptionCssBuilder.build(sheetCss, sheet.animations, elementStyles);
      const webRendering = sheet.template.rendering;
      styles[sheet.id] = {
        // `@font-face` stays outside the layers: it declares no
        // properties to cascade, and layering it would only make the
        // rules harder to read.
        css: fontFaces ? `${fontFaces}\n${layeredCss}` : layeredCss,
        addressableElementIds: elementStyles.elementIds(),
        inlineStyles,
        alignment: sheet.alignmentConfig,
        rendering: {
          splitWordsIntoLetters: webRendering.splitWordsIntoLetters,
          videoFrame: {
            required: webRendering.videoFrame.required,
            jpegQuality: webRendering.videoFrame.jpegQuality,
          },
          padding: webRendering.padding,
          textDirection: sheet.textDirection,
        },
        wordOverrides: (wordOverridesBySheet[sheet.id] ?? ElementRenderOverrides.empty())
          .mergedWith(fontOverrides.wordsBySheet[sheet.id] ?? ElementRenderOverrides.empty()),
        segmentOverrides: this.collectSegmentOverrides(subtitleDoc, sheet, elementStyles, contribution.segmentClasses)
          .mergedWith(fontOverrides.segmentsBySheet[sheet.id] ?? ElementRenderOverrides.empty()),
        svgFilters: new SvgFilterBundle(this.svgFilterDefinitionsResolver.resolve(sheet), new SheetSvgFilterScopeProvider(sheet)),
        decorationPlacements: decorationPlacementsBySheet[sheet.id] ?? new Map<string, DecorationPlacementSide>(),
      };
    }

    // Open the writer before the heavy work: if the user cancels an
    // interactive prompt we abort without spending any encoding time.
    const writer = await this.openWriter(options.format);
    if (!writer) return;

    await this.persistBeforeRender();

    this.progressStore.reset();
    const initialPhase = video.file !== null ? 'rendering' : 'awaiting-original';
    this.exportStore.start(initialPhase);
    this.editorStore.patch({ error: null });

    const overlayHtml = videoLayout
      ? this.overlayHtmlProvider?.({
          projectId,
          videoWidth: videoLayout.width,
          videoHeight: videoLayout.height,
        }) ?? null
      : null;

    let audioDiscardedReason: AudioDiscardReason | null = null;
    console.time('[export] total');
    const startedAt = performance.now();
    this.telemetry.capture('export_started', {
      format: options.format,
      quality: options.quality,
      resolution: this.describeResolution(options.resolution),
    });
    this.captureTemplateUsageAtExport(sheets);
    try {
      const videoFile = await this.resolveOriginalVideoFile(video.file);
      const topLayer = contribution.topLayer ?? undefined;
      await this.renderer.render(
        {
          video: videoFile,
          document: renderDoc,
          styles,
          ...(overlayHtml ? { overlayHtml } : {}),
          ...(topLayer ? { topLayer } : {}),
          outputFormat: options.format,
          quality: options.quality,
          ...(options.resolution !== 'original' ? { outputResolution: options.resolution } : {}),
          outputStream: writer.stream(),
          ...(cuts.isEmpty() ? {} : { skipRanges: cuts.list() }),
          confirmFallbackDecoder: (info) => this.exportPauseCoordinator.pauseAndAwait({
            kind: 'fallback-decoder',
            codec: info.inputCodec,
          }),
          onAudioDiscarded: (reason) => { audioDiscardedReason = reason; },
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
        sheets,
      }));
    } catch (err) {
      await writer.abort();
      const elapsedMs = Math.round(performance.now() - startedAt);
      if (this.isCancellation(err)) {
        this.reportCancellation(options, elapsedMs);
      } else {
        this.reportFailure(err, options, elapsedMs);
      }
    } finally {
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

  private reportFailure(err: unknown, options: ExportVideoOptions, elapsedMs: number): void {
    const appError = this.asExportError(err);
    this.editorStore.patch({ error: appError });
    this.exportStore.finish(null);
    this.telemetry.capture('export_failed', {
      format: options.format,
      resolution: this.describeResolution(options.resolution),
      elapsed_ms: elapsedMs,
      ...this.errorTelemetryDescriber.describe(appError),
    });
  }

  private buildCompletedProperties(inputs: {
    options: ExportVideoOptions;
    startedAt: number;
    audioDiscardedReason: AudioDiscardReason | null;
    sheets: readonly Sheet[];
  }): TelemetryEventProperties {
    const { video, cuts, elementStyles } = this.editorStore.snapshot();
    return {
      format: inputs.options.format,
      quality: inputs.options.quality,
      resolution: this.describeResolution(inputs.options.resolution),
      elapsed_ms: Math.round(performance.now() - inputs.startedAt),
      audio_discarded: inputs.audioDiscardedReason !== null,
      source_width: video.layout?.width ?? null,
      source_height: video.layout?.height ?? null,
      source_duration_s: video.duration,
      source_size_mb: video.file ? this.videoSizeInMegabytes(video.file) : null,
      sheet_count: inputs.sheets.length,
      total_customized_count: this.totalCustomizedCount(inputs.sheets),
      has_cuts: !cuts.isEmpty(),
      has_element_styles: !elementStyles.isEmpty(),
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
        template_categories: [...sheet.template.metadata.categories],
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

  private async persistBeforeRender(): Promise<void> {
    try {
      await this.saveProject.execute();
    } catch (cause) {
      // Best-effort: a save failure here must not block an export the
      // user already committed to, and must not land in the editor's
      // error slot, which is what the export itself reports through.
      console.error('[export] auto-save before render failed', cause);
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

  /**
   * Groups every placed word and glyph by the sheet id of the section
   * it belongs to. The renderer dispatches per frame using
   * `Section.kind` as the lookup key, so each bucket maps to one
   * `SubtitleStyle.wordOverrides`.
   */
  private collectWordPlacements(
    doc: Document,
    elementStyles: ElementStyles,
  ): Record<string, ElementRenderOverrides> {
    const buckets: Record<string, Array<readonly [string, ScopedRenderOverride]>> = {};
    for (const section of doc.sections) {
      const sheetId = section.kind;
      for (const segment of section.segments) {
        for (const line of segment.lines) {
          for (const word of line.words) {
            const wordEntry = this.buildPlacementEntry(word.id, elementStyles);
            if (wordEntry) {
              const bucket = buckets[sheetId] ?? (buckets[sheetId] = []);
              bucket.push([word.id, wordEntry]);
            }
            if (word.decoration) {
              const decorationEntry = this.buildPlacementEntry(word.decoration.id, elementStyles);
              if (decorationEntry) {
                const bucket = buckets[sheetId] ?? (buckets[sheetId] = []);
                bucket.push([word.decoration.id, decorationEntry]);
              }
            }
          }
        }
      }
    }
    const result: Record<string, ElementRenderOverrides> = {};
    for (const [sheetId, entries] of Object.entries(buckets)) {
      result[sheetId] = ElementRenderOverrides.fromEntries(entries);
    }
    return result;
  }

  /**
   * Groups the sheet's default decoration placements by the host
   * sheet id, flattened across every segment in the section so the
   * renderer can look up by decoration id alone.
   */
  private collectDecorationPlacements(
    doc: Document,
    sheets: ReadonlyArray<Sheet>,
  ): Record<string, Map<string, DecorationPlacementSide>> {
    const sheetsById = new Map<string, Sheet>(sheets.map((s) => [s.id, s]));
    const result: Record<string, Map<string, DecorationPlacementSide>> = {};
    for (const section of doc.sections) {
      const sheet = sheetsById.get(section.kind);
      if (!sheet) continue;
      for (const segment of section.segments) {
        const perSegment = this.decorationPlacementResolver.buildSegmentPlacements(sheet, segment);
        if (perSegment.size === 0) continue;
        const bucket = result[sheet.id] ?? (result[sheet.id] = new Map<string, DecorationPlacementSide>());
        for (const [decorationId, side] of perSegment) bucket.set(decorationId, side);
      }
    }
    return result;
  }

  private buildPlacementEntry(elementId: string, elementStyles: ElementStyles): ScopedRenderOverride | null {
    const placement = elementStyles.placementOf(elementId);
    return placement ? { alignment: placement } : null;
  }

  /**
   * Runs every render contributor against the same context and merges
   * the results: per-segment classes are concatenated in contributor
   * order, and at most one contributor may supply a top layer — a
   * second one is a programming error in the composition root.
   */
  private async prepareRenderContribution(
    document: Document,
    sheets: Sheet[],
    behindActorOverrides: BehindActorSegmentOverrideRegistry,
    projectId: string | null,
  ): Promise<ExportRenderContribution> {
    const segmentClasses = new Map<string, ReadonlyArray<string>>();
    let topLayer: TopLayerSource | null = null;
    for (const contributor of this.renderContributors) {
      const contribution = await contributor.prepare({ document, sheets, behindActorOverrides, projectId });
      for (const [segmentId, classes] of contribution.segmentClasses) {
        segmentClasses.set(segmentId, [...(segmentClasses.get(segmentId) ?? []), ...classes]);
      }
      if (contribution.topLayer !== null) {
        if (topLayer !== null) throw new Error('Multiple export render contributors supplied a top layer.');
        topLayer = contribution.topLayer;
      }
    }
    return { segmentClasses, topLayer };
  }

  /**
   * Builds the per-segment overrides for a sheet by walking the
   * document's segments in document order, asking the rotation resolver
   * for each and merging the user's per-segment overrides with the
   * contributed classes. Segments with no inline-style, no alignment
   * override and no classes are omitted so the renderer falls back to
   * the sheet's root defaults.
   */
  private collectSegmentOverrides(
    doc: Document,
    sheet: Sheet,
    elementStyles: ElementStyles,
    contributedSegmentClasses: ReadonlyMap<string, ReadonlyArray<string>>,
  ): ElementRenderOverrides {
    const entries: Array<readonly [string, ScopedRenderOverride]> = [];
    let segIdx = 0;
    for (const section of doc.sections) {
      if (section.kind !== sheet.id) continue;
      for (const segment of section.segments) {
        const inlineStyles = this.segmentColorRotation.resolveOverrides(sheet, segment.id, segIdx);
        const alignment = elementStyles.placementOf(segment.id);
        const classes = contributedSegmentClasses.get(segment.id);
        const scoped: ScopedRenderOverride = {
          ...(Object.keys(inlineStyles).length > 0 ? { inlineStyles } : {}),
          ...(alignment ? { alignment } : {}),
          ...(classes && classes.length > 0 ? { classes } : {}),
        };
        if (scoped.inlineStyles || scoped.alignment || scoped.classes) entries.push([segment.id, scoped]);
        segIdx++;
      }
    }
    return ElementRenderOverrides.fromEntries(entries);
  }

}
