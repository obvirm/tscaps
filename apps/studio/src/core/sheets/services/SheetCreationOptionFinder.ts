import type { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SpeakerSheetMatcher } from '@core/sheet-matchers/services/SpeakerSheetMatcher';
import type { SheetCreationOption } from '@core/sheets/domain/SheetCreationOption';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import { SHEET_ROLES, SHEET_ROLE_NAMES } from '@core/sheets/domain/SheetRole';

/**
 * Answers which sheets the project could add by name, beyond the blank
 * one that is always on offer.
 *
 * Every option has to clear the same bar: there is content waiting for
 * it, and nothing already holds that content. An option that fails
 * either half would hand over an empty sheet and read as a button that
 * did nothing, so it is not shown at all.
 */
export class SheetCreationOptionFinder {
  constructor(
    private readonly speakerSheetMatcher: SpeakerSheetMatcher,
  ) {}

  find(document: Document | null, sheets: ReadonlyArray<Sheet>): SheetCreationOption[] {
    if (!document) return [];
    return [...this.roleOptions(document, sheets), ...this.speakerOptions(document)];
  }

  private roleOptions(document: Document, sheets: ReadonlyArray<Sheet>): SheetCreationOption[] {
    const takenIds = new Set(sheets.map((sheet) => sheet.id));
    return SHEET_ROLE_NAMES
      .filter((role) => {
        const definition = SHEET_ROLES[role];
        if (takenIds.has(definition.sheetId)) return false;
        return document.getWords().some((word) => word.hasTagName(definition.tagName));
      })
      .map((role) => ({ kind: 'role', role }));
  }

  /**
   * One option per voice still sharing Main with the others, past the
   * first. The first voice is the one Main is left holding — splitting
   * every voice out would leave Main empty for no gain — and a voice is
   * dropped from the list once it has no word left under Main, which is
   * what happens the moment its sheet is created.
   *
   * Voices are numbered by order of first appearance, so the names match
   * the ones the multi-speaker flow gives when it runs at import.
   */
  private speakerOptions(document: Document): SheetCreationOption[] {
    const speakerIds = this.speakerSheetMatcher
      .collectSpeakerIds(document)
      .filter((id): id is string => id !== null);
    if (speakerIds.length < 2) return [];

    const options: SheetCreationOption[] = [];
    for (let position = 1; position < speakerIds.length; position++) {
      const speakerId = speakerIds[position]!;
      if (!this.hasWordUnderMain(document, speakerId)) continue;
      options.push({ kind: 'speaker', speakerId, name: `Speaker ${position + 1}`, position });
    }
    return options;
  }

  private hasWordUnderMain(document: Document, speakerId: string): boolean {
    for (const section of document.sections) {
      if (section.kind !== MAIN_SHEET_ID) continue;
      for (const segment of section.segments) {
        for (const word of segment.getWords()) {
          if (this.speakerSheetMatcher.matchesWord(word, { speakerId })) return true;
        }
      }
    }
    return false;
  }
}
