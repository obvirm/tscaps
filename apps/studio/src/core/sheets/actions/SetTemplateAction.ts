import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Template } from '@core/templates/domain/Template';
import type { RecordTemplateUseAction } from '@core/templates/actions/RecordTemplateUseAction';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import type { SheetElementResolver } from '@core/sheets/domain/SheetElementResolver';

/**
 * Applies a Template to the currently active Sheet — resetting style
 * values, splitter configs, alignment, and effects — and records the
 * pick as recently used. When the sheet belongs to a link group, every
 * linked sibling switches to the same template while each keeps its own
 * `variantIndex`, so a multi-speaker group rebases together and each
 * speaker lands on its matching preset in the new look — including after
 * a detour through a template that ships no presets at all.
 *
 * Per-element styles and behind-actor overrides recorded against
 * anything under the sheet — segments, lines, words, decorations — are
 * cleared alongside the sheet-level fields: the new template's CSS
 * knows nothing about the old one's variables, so a leftover word
 * colour or a leftover segment size would render against a variable
 * that no longer exists.
 */
export class SetTemplateAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly recordTemplateUse: RecordTemplateUseAction,
    private readonly telemetry: Telemetry,
    private readonly linkedSheetsSync: LinkedSheetsSync,
    private readonly sheetElementResolver: SheetElementResolver,
  ) {}

  execute(template: Template): void {
    const snap = this.store.snapshot();
    const activeSheet = this.store.activeSheet();
    if (!activeSheet) return;
    const fromTemplateId = activeSheet.template.metadata.id;
    const updated = activeSheet.withTemplate(template);

    const elementIds = this.sheetElementResolver.elementsOf(activeSheet.id);

    this.store.commit();
    this.store.patch({
      sheets: this.linkedSheetsSync.applyTemplateEdit(updated, this.store.snapshot().sheets),
      elementStyles: snap.elementStyles.without(elementIds),
      behindActorOverrides: snap.behindActorOverrides.without(elementIds),
    });
    this.refresh.execute();
    this.recordTemplateUse.execute(template.metadata.id);
    this.captureTemplateSelected(template, fromTemplateId);
  }

  private captureTemplateSelected(template: Template, fromTemplateId: string): void {
    const sameTemplate = template.metadata.id === fromTemplateId;
    this.telemetry.capture('template_selected', {
      template_id: template.metadata.id,
      template_category: template.metadata.category,
      from_template_id: sameTemplate ? null : fromTemplateId,
    });
  }
}
