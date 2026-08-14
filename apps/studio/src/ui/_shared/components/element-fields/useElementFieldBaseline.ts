import { useMemo } from 'react';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementFieldValues } from '@core/elements/domain/ElementStyles';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { ElementFieldBaselineResolver } from '@presentation/editor/services/ElementFieldBaselineResolver';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';

const NOTHING: ElementFieldValues = {};

/**
 * What each of the element's fields shows while it has been told
 * nothing, keyed by field id.
 *
 * `ancestorIds` runs nearest first and must keep its identity across
 * renders that change nothing, since the answer is recomputed whenever
 * it does not.
 */
export function useElementFieldBaseline(
  kind: ElementKind,
  sheet: Sheet | null,
  ancestorIds: ReadonlyArray<string>,
): ElementFieldValues {
  const { elementStyles } = useEditorState();
  const { styledElementCatalog } = useElements().services;

  const resolver = useMemo(
    () => new ElementFieldBaselineResolver(styledElementCatalog),
    [styledElementCatalog],
  );

  return useMemo(
    () => (sheet ? resolver.resolve(kind, sheet, ancestorIds.map((id) => elementStyles.get(id))) : NOTHING),
    [resolver, kind, sheet, ancestorIds, elementStyles],
  );
}
