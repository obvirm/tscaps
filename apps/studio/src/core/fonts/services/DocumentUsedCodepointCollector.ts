import type { Document } from '@tscaps/engine';

/**
 * Walks every word in the document and returns the set of Unicode
 * code points the captions will exercise. Used to trim `@font-face`
 * declarations subsetted by `unicode-range` down to the subsets the
 * text actually needs.
 *
 * A decoration's trailing text counts as much as a word does: it
 * renders outside the decoration's style scope, in the host word's
 * typography, so it comes out of the same faces.
 *
 * The uppercase and lowercase variants of each are included so
 * `text-transform: uppercase|lowercase` keeps working without losing
 * glyphs the source casing didn't expose.
 */
export class DocumentUsedCodepointCollector {

  collect(document: Document): Set<number> {
    const out = new Set<number>();
    for (const section of document.sections) {
      for (const segment of section.segments) {
        for (const line of segment.lines) {
          for (const word of line.words) {
            this.addEveryCasing(word.displayText, out);
            if (word.decoration?.trail) this.addEveryCasing(word.decoration.trail, out);
          }
        }
      }
    }
    return out;
  }

  private addEveryCasing(text: string, out: Set<number>): void {
    this.addCodepoints(text, out);
    this.addCodepoints(text.toUpperCase(), out);
    this.addCodepoints(text.toLowerCase(), out);
  }

  private addCodepoints(text: string, out: Set<number>): void {
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp !== undefined) out.add(cp);
    }
  }
}
