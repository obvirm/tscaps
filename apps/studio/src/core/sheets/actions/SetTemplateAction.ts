import type { Document } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Template } from '@core/templates/domain/Template';
import type { RecordTemplateUseAction } from '@core/templates/actions/RecordTemplateUseAction';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';

/**
 * Applies a Template to the currently active Sheet — resetting style
 * values, splitter configs, alignment, and effects — and records the
 * pick as recently used. When the sheet belongs to a link group, every
 * linked sibling switches to the same template while each keeps its own
 * `variantIndex` (modulo the new template's variant count), so a
 * multi-speaker group rebases together and each speaker lands on its
 * matching preset in the new look.
 */
export class SetTemplateAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly recordTemplateUse: RecordTemplateUseAction,
    private readonly telemetry: Telemetry,
    private readonly linkedSheetsSync: LinkedSheetsSync,
  ) {}

  execute(template: Template): void {
    const snap = this.store.snapshot();
    const activeSheet = this.store.activeSheet();
    if (!activeSheet) return;
    const fromTemplateId = activeSheet.template.metadata.id;
    const updated = activeSheet.withTemplate(template);

    const segmentIds = this.collectSheetSegmentIds(snap.document, activeSheet.id);

    this.store.commit();
    this.store.patch({
      sheets: this.linkedSheetsSync.applyTemplateEdit(updated, this.store.snapshot().sheets),
      elementStyles: snap.elementStyles.without(segmentIds),
      behindActorOverrides: snap.behindActorOverrides.without(segmentIds),
    });
    this.refresh.execute();
    this.recordTemplateUse.execute(template.metadata.id);
    this.captureTemplateSelected(template, fromTemplateId);
  }

  /**
   * The sheet's segments, whose ids the new template's splitter is free
   * to dissolve. What is keyed to a word survives the switch, because a
   * word keeps its id through every re-derivation.
   */
  private collectSheetSegmentIds(document: Document | null, sheetId: string): string[] {
    const segmentIds: string[] = [];
    if (!document) return segmentIds;
    for (const section of document.sections) {
      if (section.kind !== sheetId) continue;
      for (const seg of section.segments) segmentIds.push(seg.id);
    }
    return segmentIds;
  }

  private captureTemplateSelected(template: Template, fromTemplateId: string): void {
    const sameTemplate = template.metadata.id === fromTemplateId;
    this.telemetry.capture('template_selected', {
      template_id: template.metadata.id,
      template_categories: [...template.metadata.categories],
      from_template_id: sameTemplate ? null : fromTemplateId,
    });
  }
}
