import { memo } from 'react';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { ElementPositionRow } from '@ui/_shared/components/element-fields/ElementPositionRow';
import { useElementPositionBaseline } from '@ui/_shared/components/element-fields/useElementPositionBaseline';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';

interface ElementPositionPanelProps {
  elementId: string;
  kind: ElementKind;
  sheet: Sheet;
  /** The elements it sits inside, nearest first. */
  ancestorIds: ReadonlyArray<string>;
}

/**
 * Where the element sits in the frame.
 *
 * Its own block rather than a group of the fields, because a placement
 * never becomes a declaration: the element leaves the flow it was laid
 * out in and is anchored in the frame, which the renderer consumes
 * structurally. Nothing in the catalog describes it.
 */
export const ElementPositionPanel = memo(function ElementPositionPanel({
  elementId,
  kind,
  sheet,
  ancestorIds,
}: ElementPositionPanelProps) {
  const elements = useElements();
  const { elementStyles } = useEditorState();
  const baseline = useElementPositionBaseline(kind, elementId, sheet, ancestorIds);

  if (!elements.services.styledElementCatalog.canBePlaced(kind)) return null;

  return (
    <Section title="Position">
      <ElementPositionRow
        current={elementStyles.placementOf(elementId)}
        baseline={baseline}
        onCommit={(next) => {
          if (next) elements.actions.setPlacement.execute(elementId, kind, next);
          else elements.actions.setPlacement.clear(elementId, kind);
        }}
      />
    </Section>
  );
});
