import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';

/**
 * Updates one entry in the active Sheet's segment-splitter pipeline,
 * identified by its `type`, and triggers a re-derivation. The entry's
 * remaining fields are preserved; the `patch` is shallow-merged on top.
 * Sections belonging to other Sheets are unaffected. When the sheet
 * belongs to a link group, the same splitter config rides across to
 * every linked sibling.
 */
export class UpdateSegmentSplitterConfigAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly linkedSheetsSync: LinkedSheetsSync,
  ) {}

  execute(type: SegmentSplitterConfig['type'], patch: Partial<SegmentSplitterConfig>): void {
    const active = this.store.activeSheet();
    if (!active) return;
    const next = active.segmentSplitterConfigs.map((c) =>
      c.type === type ? ({ ...c, ...patch } as SegmentSplitterConfig) : c,
    );
    const updated = active.with({ segmentSplitterConfigs: next });
    this.store.commit(`segmentSplitter:${active.id}:${type}:${Object.keys(patch).join(',')}`);
    this.store.patch({ sheets: this.linkedSheetsSync.applyStyleEdit(updated, this.store.snapshot().sheets) });
    this.refresh.execute();
  }
}
