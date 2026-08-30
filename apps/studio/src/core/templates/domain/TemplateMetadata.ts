import type { TemplateCategory } from '@core/templates/domain/TemplateCategory';

export interface TemplateMetadata {
  id: string;
  name: string;
  /** The one family this template is listed under. */
  category: TemplateCategory;
  /**
   * Case-insensitive substrings matched against `navigator.userAgent`. A
   * non-empty intersection marks the template as unrenderable in the current
   * environment.
   */
  unsupportedUserAgents: readonly string[];
}
