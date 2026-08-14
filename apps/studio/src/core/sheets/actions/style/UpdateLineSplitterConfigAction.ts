import type { EditorStore } from '@core/editor/store/EditorStore';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';

/**
 * Updates the line-splitter config on the active Sheet and triggers a
 * re-derivation. Sections belonging to other Sheets are unaffected.
 * When the sheet belongs to a link group, the same line-splitter config
 * rides across to every linked sibling.
 */
export class UpdateLineSplitterConfigAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly linkedSheetsSync: LinkedSheetsSync,
  ) {}

  execute(patch: Partial<LineSplitterConfig>): void {
    const active = this.store.activeSheet();
    if (!active) return;
    const next = { ...active.lineSplitterConfig, ...patch } as LineSplitterConfig;
    const updated = active.with({ lineSplitterConfig: next });
    this.store.commit(`lineSplitter:${active.id}:${Object.keys(patch).join(',')}`);
    this.store.patch({ sheets: this.linkedSheetsSync.applyStyleEdit(updated, this.store.snapshot().sheets) });
    this.refresh.execute();
  }
}
