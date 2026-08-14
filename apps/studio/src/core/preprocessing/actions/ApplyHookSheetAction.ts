import { Document, Line, Section, Segment, Word } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { TagName } from '@core/tagging/domain/TagName';
import type { HookTemplatePicker } from '@core/sheets/services/HookTemplatePicker';
import { Sheet, HOOK_SHEET_ID, MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';

const HOOK_TAG_NAME: TagName = 'hook';

/**
 * Applies the platform's hook auto-styling to the freshly transcribed and
 * tagged editing session. When the semantic taggers have marked at least
 * one word with the `hook` tag, spawns a Hook sheet with a deliberately
 * distinct default template and reorganises the document so every
 * hook-tagged word lands in that sheet's section while the remaining
 * words stay on Main.
 *
 * Runs without committing to the undo stack — preprocessing is not meant
 * to be reversible.
 */
export class ApplyHookSheetAction {
  constructor(
    private readonly store: EditorStore,
    private readonly hookTemplatePicker: HookTemplatePicker,
  ) {}

  execute(): void {
    const { document, sheets, availableTemplates } = this.store.snapshot();
    if (!document) return;

    const main = sheets.find((s) => s.id === MAIN_SHEET_ID);
    if (!main) return;

    const hookWords = this._collectHookWords(document);
    if (hookWords.length === 0) return;

    const nonHookWords = this._collectNonHookWords(document, hookWords);
    if (nonHookWords.length === 0) return;

    const hookTemplate = this.hookTemplatePicker.pick(availableTemplates, main.template);
    if (!hookTemplate) return;

    const hookSheet = Sheet.createHook(hookTemplate);
    const repartitioned = this._repartition(document, hookWords, nonHookWords);

    this.store.patch({
      sheets: [...sheets, hookSheet],
      document: repartitioned,
    });
  }

  private _collectHookWords(document: Document): Word[] {
    return document.getWords().filter((w) => w.hasTagName(HOOK_TAG_NAME));
  }

  private _collectNonHookWords(document: Document, hookWords: ReadonlyArray<Word>): Word[] {
    const hookIds = new Set(hookWords.map((w) => w.id));
    return document.getWords().filter((w) => !hookIds.has(w.id));
  }

  /**
   * Returns a Document whose sections cleanly partition the input words
   * into a Hook section (kind = HOOK_SHEET_ID) followed by a Main section
   * (kind = MAIN_SHEET_ID). Word identities are preserved; segment and
   * line identities are not — the deriver will re-pipe each section under
   * its sheet's rules and stamp fresh ids.
   */
  private _repartition(
    document: Document,
    hookWords: ReadonlyArray<Word>,
    nonHookWords: ReadonlyArray<Word>,
  ): Document {
    const hookSection = this._wrapInSection(hookWords, HOOK_SHEET_ID);
    const mainSection = this._wrapInSection(nonHookWords, MAIN_SHEET_ID);
    return document.with({ sections: [hookSection, mainSection] });
  }

  private _wrapInSection(words: ReadonlyArray<Word>, kind: string): Section {
    const segment = new Segment({ lines: [new Line({ words })] });
    return new Section({ segments: [segment], kind });
  }
}
