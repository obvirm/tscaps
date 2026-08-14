import type { Line, Segment } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ElementDescendantResolver } from '@core/elements/domain/ElementDescendantResolver';

/**
 * What sits inside an element of the caption being edited.
 *
 * A caption nests four deep — a segment holds lines, a line holds
 * words, a word may carry a glyph — and only the document says which id
 * is inside which. It reads the document the editor is showing rather
 * than being handed one, so a caller that has an id and no document can
 * still ask.
 */
export class DocumentElementDescendantResolver implements ElementDescendantResolver {
  constructor(private readonly store: EditorStore) {}

  descendantsOf(elementId: string): ReadonlySet<string> {
    const document = this.store.snapshot().document;
    if (!document) return new Set();
    for (const segment of document.getSegments()) {
      if (segment.id === elementId) return this.inSegment(segment);
      for (const line of segment.lines) {
        if (line.id === elementId) return this.inLine(line);
        for (const word of line.words) {
          if (word.id === elementId) return word.decoration ? new Set([word.decoration.id]) : new Set();
        }
      }
    }
    return new Set();
  }

  private inSegment(segment: Segment): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const line of segment.lines) {
      ids.add(line.id);
      for (const id of this.inLine(line)) ids.add(id);
    }
    return ids;
  }

  private inLine(line: Line): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const word of line.words) {
      ids.add(word.id);
      if (word.decoration) ids.add(word.decoration.id);
    }
    return ids;
  }
}
