import type { Template } from '@core/templates/domain/Template';
import { SHEET_ROLE_TEMPLATE_CATEGORIES } from '@core/sheets/domain/SheetRole';

/**
 * Id of the template used as the platform default for hook sheets.
 * Hand-picked to harmonize with the platform default for Main; if the
 * pairing needs to change, edit this constant.
 */
const HOOK_DEFAULT_TEMPLATE_ID = 'levi';

/**
 * Picks the template a hook sheet should ship with. Prefers the
 * platform default by id; when it is absent (e.g. filtered out by
 * browser support), falls back to another template tagged with the
 * hook category that is not Main's template, so the sheet stays
 * hook-styled and visually distinct from Main. Returns `null` when no
 * suitable template exists.
 */
export class HookTemplatePicker {
  pick(availableTemplates: ReadonlyArray<Template>, mainTemplate: Template): Template | null {
    const preferred = availableTemplates.find((t) => t.metadata.id === HOOK_DEFAULT_TEMPLATE_ID);
    if (preferred) return preferred;
    const fallback = availableTemplates.find(
      (t) => t.metadata.id !== mainTemplate.metadata.id
        && t.metadata.categories.includes(SHEET_ROLE_TEMPLATE_CATEGORIES.hook),
    );
    return fallback ?? null;
  }
}
