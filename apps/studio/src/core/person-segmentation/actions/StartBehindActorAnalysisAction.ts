import type { EditorStore } from '@core/editor/store/EditorStore';
import type { CaptionedRangeCollector } from '@core/person-segmentation/services/CaptionedRangeCollector';
import type { IncrementalPersonSegmentationAnalyzer } from '@core/person-segmentation/services/IncrementalPersonSegmentationAnalyzer';

/**
 * Gets the text-behind-actor effect usable, and hands the editor back
 * as soon as it is usable *here* rather than everywhere.
 *
 * What the effect needs measured is the stretches the captions sit on,
 * minus whatever earlier passes already covered. That work goes to the
 * analyzer, which is asked for one chunk around the viewer before this
 * resolves — the head start — and left to work through the rest in the
 * background afterwards.
 *
 * Resolving therefore means "the moment on screen is ready", not "the
 * video is done": what is still owed is the analyzer's to report, and
 * a caller that needs a stretch further along has to ask for it.
 *
 * Throws when no video is loaded or when the head start fails. A
 * background failure after that is logged rather than thrown — there
 * is no caller left to receive it.
 */
export class StartBehindActorAnalysisAction {

  constructor(
    private readonly editorStore: EditorStore,
    private readonly captionedRanges: CaptionedRangeCollector,
    private readonly analyzer: IncrementalPersonSegmentationAnalyzer,
  ) {}

  async execute(): Promise<void> {
    const snapshot = this.editorStore.snapshot();
    await this.analyzer.ensureHeadStart(this.captionedRanges.collect(snapshot.document, snapshot.sheets));
  }
}
