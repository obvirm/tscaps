import type { AlignmentConfig } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';

/**
 * Updates alignment on the Sheet named by the caller. Purely visual — no
 * document re-derivation is triggered. When the user changes template
 * within the sheet, alignment resets to the new template's default (no
 * overrides). When the sheet belongs to a link group, the same alignment
 * rides across to every linked sibling. No-op when `sheetId` names no
 * sheet in the current state.
 */
export class UpdateAlignmentAction {
  constructor(
    private readonly store: EditorStore,
    private readonly linkedSheetsSync: LinkedSheetsSync,
  ) {}

  execute(sheetId: string, patch: Partial<AlignmentConfig>): void {
    const target = this.store.sheet(sheetId);
    if (!target) return;
    const updated = target.with({ alignmentConfig: { ...target.alignmentConfig, ...patch } });
    this.store.commit(`alignment:${target.id}:${Object.keys(patch).join(',')}`);
    this.store.patch({ sheets: this.linkedSheetsSync.applyStyleEdit(updated, this.store.snapshot().sheets) });
  }
}
