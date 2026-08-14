import { memo } from 'react';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { ElementFieldList } from '@ui/_shared/components/element-fields/ElementFieldList';

interface ElementStylePanelProps {
  elementId: string;
  kind: ElementKind;
  /** The sheet whose rules the element renders under, which is what its fields fall back to. */
  sheet: Sheet | null;
  /** The elements it sits inside, nearest first. */
  ancestorIds: ReadonlyArray<string>;
}

/** What the element looks like, field by field. */
export const ElementStylePanel = memo(function ElementStylePanel({
  elementId,
  kind,
  sheet,
  ancestorIds,
}: ElementStylePanelProps) {
  return <ElementFieldList elementId={elementId} kind={kind} sheet={sheet} ancestorIds={ancestorIds} />;
});
