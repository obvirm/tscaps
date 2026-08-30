import type { Template } from '@core/templates/domain/Template';
import type { RoleTemplatePicker } from '@core/sheets/services/RoleTemplatePicker';
import { Sheet } from '@core/sheets/domain/Sheet';
import { SHEET_ROLES, type SheetRole } from '@core/sheets/domain/SheetRole';

/**
 * Finds and builds the sheet that carries a narrative role. Every entry
 * point that hands content to a role — the transcript picking the
 * opening scenes, the sidebar adding the sheet outright — needs the same
 * two answers, and a role's identity is fixed enough that neither should
 * be spelled out again at each call site.
 *
 * Routing the content is the caller's, and differs per role: a hook takes
 * whole scenes, a peak takes the spans the tagger marked.
 */
export class RoleSheetProvisioner {
  constructor(
    private readonly templatePicker: RoleTemplatePicker,
  ) {}

  /**
   * The sheet already carrying the role, or `null`. A role is unique per
   * project and its sheet holds a fixed id, so this is a lookup rather
   * than a search for a second candidate.
   */
  find(role: SheetRole, sheets: ReadonlyArray<Sheet>): Sheet | null {
    return sheets.find((sheet) => sheet.id === SHEET_ROLES[role].sheetId) ?? null;
  }

  /**
   * A fresh sheet for the role, on the template the role asks for. When
   * the catalogue offers nothing suitable — templates are filtered by
   * what the device can render, so none is guaranteed — the sheet is a
   * copy of Main rather than nothing: whoever asked for the role gets a
   * sheet they can restyle instead of a request that quietly did
   * nothing.
   *
   * It reads the way Main reads, whichever of the two it comes out of.
   * The direction is a fact about the recording, not about the role, and
   * the role's own words are far too small a sample to re-read it from —
   * a hook is one scene. Re-reading would also overwrite a direction the
   * user had corrected by hand.
   */
  create(role: SheetRole, main: Sheet, availableTemplates: ReadonlyArray<Template>): Sheet {
    const template = this.templatePicker.pick(role, availableTemplates, main.template);
    if (template) return Sheet.createForRole(role, template, main.textDirection);
    const definition = SHEET_ROLES[role];
    return main.with({
      id: definition.sheetId,
      name: definition.name,
      color: definition.color,
      linkGroupId: null,
      role,
    });
  }
}
