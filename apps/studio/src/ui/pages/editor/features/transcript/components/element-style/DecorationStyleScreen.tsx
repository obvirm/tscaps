import type { Sheet } from '@core/sheets/domain/Sheet';
import { ElementStyleScreen } from '@ui/pages/editor/features/transcript/components/element-style/ElementStyleScreen';

interface DecorationStyleScreenProps {
  sheet: Sheet;
  decorationId: string;
  /** The elements the glyph sits inside, nearest first: its host word, then the scene. */
  ancestorIds: ReadonlyArray<string>;
}

/** The "Edit style" screen of an emoji's popover. */
export function DecorationStyleScreen({ sheet, decorationId, ancestorIds }: DecorationStyleScreenProps) {
  return (
    <ElementStyleScreen
      title="Emoji style"
      elementId={decorationId}
      kind="decoration"
      sheet={sheet}
      ancestorIds={ancestorIds}
    />
  );
}
