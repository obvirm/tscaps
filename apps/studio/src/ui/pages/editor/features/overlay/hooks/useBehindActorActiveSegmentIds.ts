import { useEffect, useMemo, useState } from 'react';
import type { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { BehindActorSegmentOverrideRegistry } from '@core/person-segmentation/domain/BehindActorSegmentOverrideRegistry';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { usePersonSegmentation } from '@ui/_shared/contexts/modules/PersonSegmentationContext';

const NO_ACTIVE_IDS: ReadonlySet<string> = new Set();

/**
 * Ids of the segments the text-behind-actor effect is active on, for
 * the current project's cached detector result. Recomputed when the
 * cache slot, the document, the sheets, or the user's per-segment
 * overrides change. Resolves to an empty set while no detector result
 * is loaded — without masks the effect cannot composite, so no
 * segment should activate.
 */
export function useBehindActorActiveSegmentIds(
  doc: Document,
  sheets: Sheet[],
  behindActorOverrides: BehindActorSegmentOverrideRegistry,
): ReadonlySet<string> {
  const personSegmentation = usePersonSegmentation();
  const editor = useEditor();
  const [entry, setEntry] = useState(() => personSegmentation.loadedCacheStore.current);

  useEffect(() => {
    const store = personSegmentation.loadedCacheStore;
    const update = (): void => setEntry(store.current);
    store.addEventListener('change', update);
    update();
    return () => store.removeEventListener('change', update);
  }, [personSegmentation.loadedCacheStore]);

  const templateConfigBySectionKind = useMemo(
    () => new Map<string, BehindActorTemplateConfig>(
      sheets.map((sheet) => [sheet.id, sheet.template.behindActor]),
    ),
    [sheets],
  );

  return useMemo(() => {
    if (entry === null) return NO_ACTIVE_IDS;
    if (entry.projectId !== editor.store.snapshot().projectId) return NO_ACTIVE_IDS;
    return personSegmentation.gatingService.buildActiveSegmentIds(
      doc,
      entry.result.windows,
      behindActorOverrides.all(),
      templateConfigBySectionKind,
    );
  }, [entry, doc, behindActorOverrides, templateConfigBySectionKind, personSegmentation.gatingService, editor.store]);
}
