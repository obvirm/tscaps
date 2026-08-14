import type { Sheet } from '@core/sheets/domain/Sheet';
import { ElementStyleScreen } from '@ui/pages/editor/features/transcript/components/element-style/ElementStyleScreen';

interface SegmentStyleScreenProps {
  sheet: Sheet;
  segmentId: string;
}

const NO_ANCESTORS: ReadonlyArray<string> = [];

/** The "Edit style" screen of a scene's popover. */
export function SegmentStyleScreen({ sheet, segmentId }: SegmentStyleScreenProps) {
  return (
    <ElementStyleScreen
      title="Style"
      elementId={segmentId}
      kind="segment"
      sheet={sheet}
      ancestorIds={NO_ANCESTORS}
    />
  );
}
