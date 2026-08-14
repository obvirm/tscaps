import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { EditWordTextAction } from '@core/captions/actions/words/EditWordTextAction';
import { EditWordTimeAction } from '@core/captions/actions/words/EditWordTimeAction';
import { EditWordTagsAction } from '@core/captions/actions/words/EditWordTagsAction';
import { DeleteWordsAction } from '@core/captions/actions/words/DeleteWordsAction';
import { InsertWordAction } from '@core/captions/actions/words/InsertWordAction';
import { AddDecorationAction } from '@core/captions/actions/decorations/AddDecorationAction';
import { SetDecorationOverrideAction } from '@core/captions/actions/decorations/SetDecorationOverrideAction';
import { ClearDecorationAction } from '@core/captions/actions/decorations/ClearDecorationAction';
import { SetSegmentBehindActorOverrideAction } from '@core/captions/actions/segments/SetSegmentBehindActorOverrideAction';
import { ApplyStructureEditAction } from '@core/captions/actions/segments/ApplyStructureEditAction';
import { ApplySmartSegmentEditAction } from '@core/captions/actions/segments/ApplySmartSegmentEditAction';
import { SplitSegmentAtCursorAction } from '@core/captions/actions/segments/SplitSegmentAtCursorAction';
import { MergeSegmentWithSiblingAction } from '@core/captions/actions/segments/MergeSegmentWithSiblingAction';
import { EditSegmentTimeAction } from '@core/captions/actions/segments/EditSegmentTimeAction';
import { RedistributeSegmentWordsAction } from '@core/captions/actions/segments/RedistributeSegmentWordsAction';
import { InsertSegmentAction } from '@core/captions/actions/segments/InsertSegmentAction';
import { ResetSegmentLayoutAction } from '@core/captions/actions/segments/ResetSegmentLayoutAction';
import { ResetSheetLayoutAction } from '@core/captions/actions/segments/ResetSheetLayoutAction';
import { WordTimeBounds } from '@core/captions/services/WordTimeBounds';
import { SegmentHardTime } from '@core/captions/services/SegmentHardTime';
import { SegmentTimeBounds } from '@core/captions/services/SegmentTimeBounds';
import { RelocatedWordClamp } from '@core/captions/services/RelocatedWordClamp';
import { DocumentElementDescendantResolver } from '@core/captions/services/DocumentElementDescendantResolver';
import { DocumentSheetElementResolver } from '@core/captions/services/DocumentSheetElementResolver';

export interface CaptionsDependencies {
  readonly store: EditorStore;
  readonly deriver: DocumentDeriver;
  readonly refresh: RefreshDocumentAction;
}

export type CaptionsModule = ReturnType<typeof bootCaptions>;

/**
 * Boots every action that shapes the captions output — text edits,
 * decoration management, style overrides, structure changes, layout
 * resets. These actions are dispatched from several surfaces inside
 * the Captions mode: the Transcript subtab, the Layout subtab, the
 * overlay popovers triggered by clicking on the rendered captions,
 * and the overlay manipulation controller that drives drag / resize /
 * rotate gestures. The module groups them by domain entity so each
 * dispatcher imports the same `actions.words`, `actions.decorations`,
 * `actions.segments` surface.
 */
export function bootCaptions(deps: CaptionsDependencies) {
  const { store, deriver, refresh } = deps;
  const videoDurationProvider = () => store.snapshot().video.duration;
  const wordTimeBounds = new WordTimeBounds();
  const segmentHardTime = new SegmentHardTime();
  const segmentTimeBounds = new SegmentTimeBounds(segmentHardTime);
  const relocatedWordClamp = new RelocatedWordClamp(wordTimeBounds, segmentTimeBounds);
  return {
    services: {
      wordTimeBounds,
      segmentTimeBounds,
      elementDescendantResolver: new DocumentElementDescendantResolver(store),
      sheetElementResolver: new DocumentSheetElementResolver(store),
    },
    actions: {
      words: {
        editText: new EditWordTextAction(store, deriver),
        editTime: new EditWordTimeAction(store, deriver, wordTimeBounds, segmentTimeBounds),
        editTags: new EditWordTagsAction(store, deriver),
        delete: new DeleteWordsAction(store, deriver),
        insert: new InsertWordAction(store, deriver),
      },
      decorations: {
        add: new AddDecorationAction(store, deriver),
        setOverride: new SetDecorationOverrideAction(store, refresh),
        clear: new ClearDecorationAction(store, deriver),
      },
      segments: {
        setBehindActorOverride: new SetSegmentBehindActorOverrideAction(store),
        applyStructureEdit: new ApplyStructureEditAction(store, deriver, relocatedWordClamp),
        applySmartEdit: new ApplySmartSegmentEditAction(store, deriver, videoDurationProvider),
        splitAtCursor: new SplitSegmentAtCursorAction(store, deriver, videoDurationProvider),
        mergeWithSibling: new MergeSegmentWithSiblingAction(store, deriver, videoDurationProvider),
        editTime: new EditSegmentTimeAction(store, deriver, segmentTimeBounds),
        redistributeWords: new RedistributeSegmentWordsAction(store, deriver),
        insert: new InsertSegmentAction(store, deriver, videoDurationProvider, segmentHardTime, segmentTimeBounds),
        resetLayout: new ResetSegmentLayoutAction(store, refresh),
        resetSheetLayout: new ResetSheetLayoutAction(store, refresh),
      },
    },
  };
}
