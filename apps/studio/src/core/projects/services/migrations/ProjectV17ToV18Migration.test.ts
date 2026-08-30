import { describe, expect, it } from 'vitest';
import { ProjectV17ToV18Migration } from '@core/projects/services/migrations/ProjectV17ToV18Migration';

/**
 * A tag that changed its name, on projects written before it did.
 *
 * The name is what a template selects on: a word still stored as
 * `highlight` carries a CSS class nothing styles, so the lines a viewer
 * was meant to see lifted come back looking like every other caption.
 * The word is not lost, which is what makes the failure quiet.
 */

const migration = new ProjectV17ToV18Migration();

function word(semanticTags: string[]): Record<string, unknown> {
  return { id: 'w1', text: 'consistency', start: 0, end: 1, structureTags: [], semanticTags };
}

function documentWith(words: Record<string, unknown>[]): Record<string, unknown> {
  return { sections: [{ id: 's1', kind: 'main', structureTags: [], segments: [
    { id: 'g1', structureTags: [], lines: [{ id: 'l1', structureTags: [], words }] },
  ] }] };
}

function migratedWords(words: Record<string, unknown>[]): Record<string, unknown>[] {
  const data = migration.migrate({ version: 17, document: documentWith(words) });
  const doc = data.document as Record<string, never>;
  const sections = doc.sections as unknown as Record<string, never>[];
  const segments = sections[0]!.segments as unknown as Record<string, never>[];
  const lines = segments[0]!.lines as unknown as Record<string, never>[];
  return lines[0]!.words as unknown as Record<string, unknown>[];
}

function migratedSheets(sheets: Record<string, unknown>[]): Record<string, unknown>[] {
  return migration.migrate({ version: 17, sheets }).sheets as Record<string, unknown>[];
}

describe('a word tagged before the rename', () => {
  it('comes back under the new name', () => {
    expect(migratedWords([word(['highlight'])])[0]!.semanticTags).toEqual(['peak']);
  });

  it('keeps the tags it carries alongside it, in order', () => {
    const tags = migratedWords([word(['entity', 'highlight', 'emphasis'])])[0]!.semanticTags;
    expect(tags).toEqual(['entity', 'peak', 'emphasis']);
  });

  it('is rewritten wherever it sits, structure set included', () => {
    const data = migration.migrate({
      version: 17,
      document: documentWith([{ ...word([]), structureTags: ['highlight'] }]),
    });
    const doc = data.document as Record<string, never>;
    const sections = doc.sections as unknown as Record<string, never>[];
    const segments = sections[0]!.segments as unknown as Record<string, never>[];
    const lines = segments[0]!.lines as unknown as Record<string, never>[];
    const words = lines[0]!.words as unknown as Record<string, unknown>[];
    expect(words[0]!.structureTags).toEqual(['peak']);
  });

  it('leaves every other tag alone', () => {
    expect(migratedWords([word(['hook', 'quote'])])[0]!.semanticTags).toEqual(['hook', 'quote']);
  });
});

describe('the control that paints the tag', () => {
  it('moves to the new id on a sheet using the template that declares it', () => {
    const sheets = migratedSheets([{ id: 'main', templateId: 'kel', styleValues: { 'tag-bg-color': '#123456' } }]);
    expect(sheets[0]!.styleValues).toEqual({ 'peak-bg-color': '#123456' });
  });

  it('carries the value the user chose, not the template default', () => {
    const sheets = migratedSheets([{ id: 'main', templateId: 'kel', styleValues: { 'tag-bg-color': '#ff0000' } }]);
    expect((sheets[0]!.styleValues as Record<string, unknown>)['peak-bg-color']).toBe('#ff0000');
  });

  it('leaves the id alone under a template where it means something else', () => {
    const sheets = migratedSheets([{ id: 'main', templateId: 'mira', styleValues: { 'tag-bg-color': '#123456' } }]);
    expect(sheets[0]!.styleValues).toEqual({ 'tag-bg-color': '#123456' });
  });

  it('leaves a kel sheet that never customised it untouched', () => {
    const sheets = migratedSheets([{ id: 'main', templateId: 'kel', styleValues: { 'highlight-color': '#569cd6' } }]);
    expect(sheets[0]!.styleValues).toEqual({ 'highlight-color': '#569cd6' });
  });
});

describe('a payload the step has nothing to do for', () => {
  it('survives a project with no document', () => {
    expect(migration.migrate({ version: 17, sheets: [] })).toEqual({ version: 17, sheets: [] });
  });

  it('survives a malformed document rather than throwing', () => {
    expect(migration.migrate({ version: 17, document: null })).toEqual({ version: 17, document: null });
  });
});
