import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

const OLD_TAG_NAME = 'highlight';
const NEW_TAG_NAME = 'peak';

const KEL_TEMPLATE_ID = 'kel';
const OLD_KEL_CONTROL_ID = 'tag-bg-color';
const NEW_KEL_CONTROL_ID = 'peak-bg-color';

/**
 * v17 → v18: renames the `highlight` tag to `peak`, on the words that
 * carry it and on the one control that paints it.
 *
 * The name collided with the templates' own vocabulary, where
 * `highlight-color` is the word currently being narrated — a different
 * thing entirely, and the one 14 templates mean by it. A stored tag
 * keeping the old name renders no CSS class any template selects, so
 * the words a viewer was meant to see lifted come out looking ordinary.
 *
 * Both tag sets are rewritten. The name only ever belonged to the
 * semantic vocabulary, but a word carries two sets, both become CSS
 * classes, and no tagger ever wrote `highlight` into the other one —
 * so covering both costs nothing and needs no assumption about which
 * set a given payload used.
 */
export class ProjectV17ToV18Migration implements ProjectMigration {
  readonly fromVersion = 17;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return {
      ...data,
      ...(this.isRecord(data.document) ? { document: this.withRenamedTags(data.document) } : {}),
      ...(Array.isArray(data.sheets) ? { sheets: data.sheets.map((sheet) => this.withRenamedControl(sheet)) } : {}),
    };
  }

  /**
   * The node with every `structureTags` / `semanticTags` array under it
   * rewritten. Walks whatever nesting the payload has rather than the
   * section → segment → line → word chain by name, so a shape that grows
   * a level still gets covered.
   */
  private withRenamedTags(node: unknown): unknown {
    if (Array.isArray(node)) return node.map((child) => this.withRenamedTags(child));
    if (!this.isRecord(node)) return node;
    const rewritten: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      rewritten[key] = this.isTagArrayKey(key) && Array.isArray(value)
        ? value.map((tag) => (tag === OLD_TAG_NAME ? NEW_TAG_NAME : tag))
        : this.withRenamedTags(value);
    }
    return rewritten;
  }

  private isTagArrayKey(key: string): boolean {
    return key === 'structureTags' || key === 'semanticTags';
  }

  /**
   * The sheet with the control that paints the tag renamed alongside it.
   * Only kel ever declared it, and only under that template does the old
   * id mean this tag, so a sheet on any other template is left alone.
   */
  private withRenamedControl(sheet: unknown): unknown {
    if (!this.isRecord(sheet)) return sheet;
    if (sheet.templateId !== KEL_TEMPLATE_ID) return sheet;
    if (!this.isRecord(sheet.styleValues)) return sheet;
    const { [OLD_KEL_CONTROL_ID]: stored, ...rest } = sheet.styleValues;
    if (stored === undefined) return sheet;
    return { ...sheet, styleValues: { ...rest, [NEW_KEL_CONTROL_ID]: stored } };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
