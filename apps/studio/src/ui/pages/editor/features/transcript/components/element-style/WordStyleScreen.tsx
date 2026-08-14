import { useMemo } from 'react';
import type { Segment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { ElementStyleScreen } from '@ui/pages/editor/features/transcript/components/element-style/ElementStyleScreen';

interface WordStyleScreenProps {
  sheet: Sheet;
  segment: Segment;
  word: Word;
}

/** The "Edit style" screen of a word's popover. */
export function WordStyleScreen({ sheet, segment, word }: WordStyleScreenProps) {
  const ancestorIds = useMemo(() => [segment.id], [segment.id]);

  return (
    <ElementStyleScreen
      title="Style"
      elementId={word.id}
      kind="word"
      sheet={sheet}
      ancestorIds={ancestorIds}
    />
  );
}
