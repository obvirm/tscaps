import type { Segment } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SheetElementResolver } from '@core/sheets/domain/SheetElementResolver';

/**
 * Which elements of the caption being edited render under a sheet.
 *
 * A section names the sheet its captions are painted with, so the walk
 * starts there and takes everything below. It reads the document the
 * editor is showing rather than being handed one, so a caller that has
 * a sheet id and no document can still ask.
 */
export class DocumentSheetElementResolver implements SheetElementResolver {
  constructor(private readonly store: EditorStore) {}

  elementsOf(sheetId: string): ReadonlySet<string> {
    const document = this.store.snapshot().document;
    const ids = new Set<string>();
    if (!document) return ids;
    for (const section of document.sections) {
      if (section.kind !== sheetId) continue;
      for (const segment of section.segments) this.collectSegment(segment, ids);
    }
    return ids;
  }

  private collectSegment(segment: Segment, ids: Set<string>): void {
    ids.add(segment.id);
    for (const line of segment.lines) {
      ids.add(line.id);
      for (const word of line.words) {
        ids.add(word.id);
        if (word.decoration) ids.add(word.decoration.id);
      }
    }
  }
}
