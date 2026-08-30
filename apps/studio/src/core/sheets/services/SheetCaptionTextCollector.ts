import type { Document } from '@tscaps/engine';

/**
 * Gathers the text a sheet renders, for the resolutions that depend on
 * what the captions say rather than on how they are styled — classifying
 * the sheet's writing system, most of all.
 */
export class SheetCaptionTextCollector {

  /**
   * Every word of every segment the sheet owns in `document`, plus the
   * trailing text of any decoration hanging off one, space-joined.
   *
   * A decoration's trail renders outside its own style scope, in the
   * host word's typography, so it draws with the caption's faces and
   * has the same claim on them as a word does.
   */
  collect(document: Document, sheetId: string): string {
    const parts: string[] = [];
    for (const section of document.sections) {
      if (section.kind !== sheetId) continue;
      for (const segment of section.segments) {
        for (const word of segment.getWords()) {
          parts.push(word.displayText);
          if (word.decoration?.trail) parts.push(word.decoration.trail);
        }
      }
    }
    return parts.join(' ');
  }
}
