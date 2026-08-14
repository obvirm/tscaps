import type { TimelineGapCell } from '@presentation/timeline/services/TimelineProjection';
import type { TimelineRowGeometry } from '@presentation/timeline/services/TimelineRowGeometryResolver';
import { GapChip } from '@ui/pages/editor/features/timeline/components/chips/GapChip';

// The layer itself never takes the pointer: it covers the whole row and
// would answer for every press on it. Its chips opt back in.
const LAYER_CLASS = 'absolute left-0 right-0 pointer-events-none';

interface SilenceLayerProps {
  silences: ReadonlyArray<TimelineGapCell>;
  geometry: TimelineRowGeometry;
  rowStartSec: number;
  rowDurationSec: number;
  onSelect: (startSec: number, endSec: number) => void;
}

/**
 * The stretches of one row where no scene is saying anything.
 *
 * Silence belongs to the row rather than to any one scene: a pause in
 * one while another speaks is not a pause, and cutting one removes that
 * time from the whole video. It is drawn in the channel's chip band, so
 * it takes a word's shape and sits in the same run the words do — which
 * is what the single channel buys, since there is no longer a choice of
 * band that could make a fact about the whole row look local.
 */
export function SilenceLayer({
  silences,
  geometry,
  rowStartSec,
  rowDurationSec,
  onSelect,
}: SilenceLayerProps) {
  return (
    <div
      className={LAYER_CLASS}
      style={{ top: geometry.chipInsetTopPx, height: geometry.chipHeightPx }}
    >
      {silences.map((silence) => (
        <GapChip
          key={silence.id}
          cell={silence}
          rowStartSec={rowStartSec}
          rowDurationSec={rowDurationSec}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
