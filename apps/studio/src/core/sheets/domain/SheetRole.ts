/**
 * Narrative role a sheet plays in the video's caption structure. A role
 * names what the sheet's content is for (the opening attention line),
 * not how it looks — styling stays entirely in the sheet's template and
 * controls. Roles are not singletons: several sheets may carry the same
 * one. The union grows as the platform adds roles.
 */
export type SheetRole = 'hook';

/**
 * Template-gallery category each role prefers. Role literals and
 * category ids are aligned by convention; the mapping exists so a
 * renamed category never silently detaches from its role.
 */
export const SHEET_ROLE_TEMPLATE_CATEGORIES: Readonly<Record<SheetRole, string>> = {
  hook: 'hook',
};
