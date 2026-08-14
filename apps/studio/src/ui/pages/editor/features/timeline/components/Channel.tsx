import type { TimelineWordEdit } from '@presentation/timeline/controllers/TimelineEditingController';
import type {
  TimelineOverlapSpan,
  TimelineSceneRun,
  TimelineWordCell,
} from '@presentation/timeline/services/TimelineProjection';
import type { TimelineWordDragTargets } from '@presentation/timeline/services/TimelineWordDragTargets';
import type { TimelineRowGeometry } from '@presentation/timeline/services/TimelineRowGeometryResolver';
import { WordChip } from '@ui/pages/editor/features/timeline/components/chips/WordChip';
import { SceneRunLayer } from '@ui/pages/editor/features/timeline/components/overlays/SceneRunLayer';
import type { TimelineSceneDragTargets } from '@presentation/timeline/services/TimelineSceneDragTargets';
import { WordOverlapOverlay } from '@ui/pages/editor/features/timeline/components/overlays/WordOverlapOverlay';

// A filled, outlined trough, so the channel is a thing rather than a
// stretch of empty track: unbounded chips read as words floating over
// the row rather than as words on a track. It takes the surface the
// chips were already measured against and lets the row show through
// around it, rather than the other way round — raising the channel's own
// surface costs the chips about forty percent of their contrast.
//
// An inset ring rather than a border: a border shifts the content box
// inward, which would put the chips on a different time-to-x mapping
// than the cut masks and the playhead.
const CHANNEL_CLASS =
  'absolute inset-x-0 top-0 overflow-hidden bg-surface-1 '
  + 'ring-1 ring-inset ring-edge-medium rounded-xs';

// Carries the inset from the channel's top, so a chip stays a plain
// `top: 0, bottom: 0` fill of whatever band it is given.
const CHIP_BAND_CLASS = 'absolute left-0 right-0';


interface ChannelProps {
  cells: ReadonlyArray<TimelineWordCell>;
  sceneRuns: ReadonlyArray<TimelineSceneRun>;
  overlaps: ReadonlyArray<TimelineOverlapSpan>;
  geometry: TimelineRowGeometry;
  rowStartSec: number;
  rowEndSec: number;
  rowDurationSec: number;
  dragTargets: TimelineWordDragTargets;
  sceneDragTargets: TimelineSceneDragTargets;
  onCutScene: (startSec: number, endSec: number) => void;
  wordEdit: TimelineWordEdit | null;
  highlightedSegmentId: string | null;
}

/**
 * The one band of words a row draws, with the marking for any stretch
 * two words of a scene share and a single coloured bar running
 * underneath, changing colour wherever the scene does.
 *
 * At most one scene runs at any instant, so a word never has to give way
 * to another: sheets that claim the same instant are read in separate
 * channels, and two segments of one sheet are kept from sharing one.
 *
 * The word currently being dragged is drawn from the live edit rather
 * than from the row's own cells, because it can be pulled past the row
 * it started in.
 */
export function Channel({
  cells,
  sceneRuns,
  overlaps,
  geometry,
  rowStartSec,
  rowEndSec,
  rowDurationSec,
  dragTargets,
  sceneDragTargets,
  onCutScene,
  wordEdit,
  highlightedSegmentId,
}: ChannelProps) {
  const draggedWordId = wordEdit?.wordId ?? null;
  const showsDraggedWord = wordEdit !== null
    && wordEdit.range.endSec > rowStartSec
    && wordEdit.range.startSec < rowEndSec;

  // The dragged word is cut to this row the same way a settled one is,
  // so crossing a boundary mid-drag looks like where it will land.
  const draggedCell: TimelineWordCell | null = showsDraggedWord && wordEdit
    ? {
      id: wordEdit.wordId,
      text: wordEdit.text,
      segmentId: wordEdit.segmentId,
      startSec: Math.max(wordEdit.range.startSec, rowStartSec),
      endSec: Math.min(wordEdit.range.endSec, rowEndSec),
      fullStartSec: wordEdit.range.startSec,
      fullEndSec: wordEdit.range.endSec,
      cutAtStart: wordEdit.range.startSec < rowStartSec,
      cutAtEnd: wordEdit.range.endSec > rowEndSec,
      isWidestPiece: false,
    }
    : null;

  return (
    <div className={CHANNEL_CLASS} style={{ height: geometry.channelHeightPx }}>
      {/* Before the chips in tree order, so its wash paints behind them
          and they take the pointer first wherever one of them sits. */}
      <SceneRunLayer
        sceneRuns={sceneRuns}
        geometry={geometry}
        rowStartSec={rowStartSec}
        rowDurationSec={rowDurationSec}
        highlightedSegmentId={highlightedSegmentId}
        sceneDragTargets={sceneDragTargets}
        onCutScene={onCutScene}
      />
      <div
        className={CHIP_BAND_CLASS}
        style={{ top: geometry.chipInsetTopPx, height: geometry.chipHeightPx }}
      >
        {cells.map((cell) => (
          cell.id === draggedWordId ? null : (
            <WordChip
              key={`${cell.id}-${cell.startSec}`}
              cell={cell}
              rowStartSec={rowStartSec}
              rowDurationSec={rowDurationSec}
              dragTarget={dragTargets.get(cell.id) ?? null}
            />
          )
        ))}
        <WordOverlapOverlay
          overlaps={overlaps}
          rowStartSec={rowStartSec}
          rowDurationSec={rowDurationSec}
        />
        {draggedCell && (
          <WordChip
            cell={draggedCell}
            rowStartSec={rowStartSec}
            rowDurationSec={rowDurationSec}
            dragTarget={null}
          />
        )}
      </div>
    </div>
  );
}
