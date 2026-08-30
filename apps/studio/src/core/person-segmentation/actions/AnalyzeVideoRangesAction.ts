import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import type { PersonSegmentationRunRanges } from '@core/person-segmentation/domain/PersonSegmentationRunRanges';
import type { PersonSegmentationCachePersister } from '@core/person-segmentation/services/PersonSegmentationCachePersister';
import type { PersonSegmentationResultAssembler } from '@core/person-segmentation/services/PersonSegmentationResultAssembler';
import type { PersonSegmentationResultReader } from '@core/person-segmentation/services/PersonSegmentationResultReader';
import type { RunPersonSegmentationAction } from '@core/person-segmentation/actions/RunPersonSegmentationAction';
import type { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';

/**
 * Measures the given stretches of an already-loaded video and folds
 * what it learns into what the project already knew, publishing the
 * result so the preview picks it up and marking it to be written.
 *
 * The caller owns the video element and decides which stretches to ask
 * about — and how far past them to look, since the two are not the
 * same — which is what lets the same action serve a first pass, a
 * background sweep, and a repair around a seek without reloading
 * anything between them.
 *
 * Sessions without a persisted project id are supported: the result
 * lives only in memory. Rejects with an `AbortError` when the run is
 * cancelled; nothing is published in that case.
 */
export class AnalyzeVideoRangesAction {

  constructor(
    private readonly editorStore: EditorStore,
    private readonly runAction: RunPersonSegmentationAction,
    private readonly resultReader: PersonSegmentationResultReader,
    private readonly assembler: PersonSegmentationResultAssembler,
    private readonly loadedStore: LoadedPersonSegmentationCacheStore,
    private readonly persister: PersonSegmentationCachePersister,
  ) {}

  async execute(video: HTMLVideoElement, ranges: PersonSegmentationRunRanges): Promise<void> {
    if (ranges.toScan.isEmpty()) return;
    const projectId = this.editorStore.snapshot().projectId;
    const measured = await this.runAction.execute({ video, ranges });
    const result = await this.foldedIntoWhatIsKnown(projectId, measured);
    this.loadedStore.publish(projectId, result);
    this.persister.markDirty(projectId);
  }

  /**
   * What was just measured laid on top of what the project already
   * knew, rather than in place of it. Coverage is the union of both,
   * so a stretch measured by an earlier pass stays measured; the fresh
   * measurements win any instant both looked at. Replacing outright
   * would drop the masks backfilled for a segment forced on by hand —
   * they sit outside every window a scan captures — and leave that
   * segment lifting its text with no actor to hide behind.
   */
  private async foldedIntoWhatIsKnown(
    projectId: string | null,
    measured: PersonSegmentationResult,
  ): Promise<PersonSegmentationResult> {
    const existing = await this.resultReader.read(projectId);
    if (existing === null) return measured;
    return this.assembler.merged(existing, measured);
  }
}
