import { useLayoutEffect, useMemo, useState } from 'react';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementPositionBaseline } from '@presentation/editor/services/ElementAlignmentResolver';
import { measureElementAnchorFraction } from '@ui/pages/editor/features/overlay/elementPositionProbe';
import { useElementAlignmentResolver } from '@ui/pages/editor/contexts/ElementAlignmentContext';
import { useRendering } from '@ui/_shared/contexts/modules/RenderingContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';

/**
 * Where the element sits while nobody has moved it, in screen terms and
 * with its anchors, so the number a slider shows is the number a commit
 * would store.
 *
 * A caption answers from its sheet, since its own placement is the
 * thing being replaced rather than inherited. Anything inside one
 * answers from where it is actually painted: an element in the flow has
 * no stored position, so measuring is what keeps the first tick of a
 * slider from throwing it somewhere else. It falls back to the caption's
 * anchor when the element is not on screen at the current frame.
 *
 * Measured after the DOM has been written, never while deciding what to
 * write. A render triggered by an edit still has the previous layout on
 * screen, so a measurement taken then describes where the element was
 * before that edit — which is how returning a word to the flow reported
 * the spot the cursor released rather than the spot it landed in.
 *
 * Only measured while the element is in the flow: once it carries a
 * placement, that placement is the answer and reading layout on every
 * write would force a reflow per gesture tick.
 *
 * `ancestorIds` is nearest first, so the caption an element belongs to
 * is the last of them.
 */
export function useElementPositionBaseline(
  kind: ElementKind,
  elementId: string,
  sheet: Sheet,
  ancestorIds: ReadonlyArray<string>,
): ElementPositionBaseline {
  const resolver = useElementAlignmentResolver();
  const { horizontalPlacementResolver } = useRendering();
  const { elementStyles } = useEditorState();
  const segmentId = ancestorIds[ancestorIds.length - 1];
  const isPlaced = elementStyles.placementOf(elementId) !== null;

  const alignment = useMemo(
    () => (kind === 'segment' || segmentId === undefined
      ? sheet.alignmentConfig
      : resolver.segmentEffectiveAlignment(sheet, segmentId, elementStyles)),
    [kind, segmentId, sheet, elementStyles, resolver],
  );
  const inherited = useMemo(
    () => resolver.positionBaseline(alignment, sheet.textDirection, null),
    [resolver, alignment, sheet.textDirection],
  );

  // Spread so the effect answers to the anchor's four values rather than
  // to a new object on every unrelated write to the styles.
  const { verticalAlign, verticalOffset, horizontalAlign, horizontalOffset } = alignment;
  const { textDirection } = sheet;
  const [measured, setMeasured] = useState<ElementPositionBaseline | null>(null);

  useLayoutEffect(() => {
    if (kind === 'segment' || isPlaced) {
      setMeasured(null);
      return;
    }
    setMeasured(measureElementAnchorFraction(
      elementId,
      { verticalAlign, verticalOffset, horizontalAlign, horizontalOffset },
      textDirection,
      horizontalPlacementResolver,
    ));
  }, [
    kind, isPlaced, elementId, textDirection, horizontalPlacementResolver,
    verticalAlign, verticalOffset, horizontalAlign, horizontalOffset,
  ]);

  return measured ?? inherited;
}
