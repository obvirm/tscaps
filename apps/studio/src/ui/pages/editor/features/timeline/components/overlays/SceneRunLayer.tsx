import type { TimelineSceneRun } from '@presentation/timeline/services/TimelineProjection';
import type { TimelineRowGeometry } from '@presentation/timeline/services/TimelineRowGeometryResolver';
import type { TimelineSceneDragTargets } from '@presentation/timeline/services/TimelineSceneDragTargets';
import {
  useTimelineSceneEditInRow,
  useTimelineSelectedSceneId,
} from '@ui/pages/editor/features/timeline/hooks/useTimelineEditing';
import { SceneRun } from '@ui/pages/editor/features/timeline/components/overlays/SceneRun';

// Never takes the pointer itself; each scene opts back in over the
// stretches it is on top of, so the parts of the channel no scene
// reaches stay with the row's interaction zone.
const LAYER_CLASS = 'absolute inset-0 pointer-events-none';

interface SceneRunLayerProps {
  sceneRuns: ReadonlyArray<TimelineSceneRun>;
  geometry: TimelineRowGeometry;
  rowStartSec: number;
  rowDurationSec: number;
  /** The scene a search match is sitting on, which is not a selection. */
  highlightedSegmentId: string | null;
  sceneDragTargets: TimelineSceneDragTargets;
  onCutScene: (startSec: number, endSec: number) => void;
}

/**
 * Where the scenes run beneath one row's channel of words.
 *
 * One bar, whatever the scene count: it changes colour wherever the
 * scene on top changes, and a scene covered end to end simply does not
 * appear in it. A plain document draws one unbroken bar under the words
 * the way a single track always did.
 *
 * A scene carried over from the row above starts flush with the row, its
 * real start being clipped away.
 *
 * Which scene is held, and where one is being dragged to, are read here
 * rather than by the row: holding a scene or moving its edge then
 * redraws this layer alone and leaves the row's chips and waveform
 * untouched.
 */
export function SceneRunLayer({
  sceneRuns,
  geometry,
  rowStartSec,
  rowDurationSec,
  highlightedSegmentId,
  sceneDragTargets,
  onCutScene,
}: SceneRunLayerProps) {
  const heldSceneId = useTimelineSelectedSceneId();
  const sceneEdit = useTimelineSceneEditInRow(rowStartSec, rowStartSec + rowDurationSec);

  return (
    <div className={LAYER_CLASS}>
      {sceneRuns.map((run) => (
        <SceneRun
          key={run.segmentId}
          run={run}
          geometry={geometry}
          rowStartSec={rowStartSec}
          rowDurationSec={rowDurationSec}
          isSearchMatch={run.segmentId === highlightedSegmentId}
          isHeld={run.segmentId === heldSceneId}
          heldWindow={sceneEdit?.segmentId === run.segmentId ? sceneEdit.range : null}
          sceneDragTargets={sceneDragTargets}
          onCutScene={onCutScene}
        />
      ))}
    </div>
  );
}
