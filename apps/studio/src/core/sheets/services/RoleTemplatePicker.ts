import type { Template } from '@core/templates/domain/Template';
import { SHEET_ROLES, type SheetRole } from '@core/sheets/domain/SheetRole';

/**
 * Picks the template a role's sheet should ship with. Prefers the
 * template the role asks for by id; when it is absent — capability
 * filtering drops the ones a browser gets wrong, so no template is
 * guaranteed to be there — falls back to another one in the role's
 * category that Main is not already using, so the sheet stays true to
 * the role and stays visually distinct from Main. Returns `null` when
 * no suitable template exists.
 */
export class RoleTemplatePicker {
  pick(role: SheetRole, availableTemplates: ReadonlyArray<Template>, mainTemplate: Template): Template | null {
    const definition = SHEET_ROLES[role];
    const preferred = availableTemplates.find((t) => t.metadata.id === definition.preferredTemplateId);
    if (preferred) return preferred;
    const fallback = availableTemplates.find(
      (t) => t.metadata.id !== mainTemplate.metadata.id
        && t.metadata.category === definition.templateCategory,
    );
    return fallback ?? null;
  }
}
