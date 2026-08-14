import type { Document } from '@tscaps/engine';

/** Every id a stylesheet could address in a document: segments, lines, words and their decorations. */
export class DocumentElementIdCollector {
  collect(document: Document): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const segment of document.getSegments()) {
      ids.add(segment.id);
      for (const line of segment.lines) {
        ids.add(line.id);
        for (const word of line.words) {
          ids.add(word.id);
          if (word.decoration) ids.add(word.decoration.id);
        }
      }
    }
    return ids;
  }
}
