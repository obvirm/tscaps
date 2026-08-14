import type { Document, Word } from '@tscaps/engine';
import type {
  WordSheetMatcher,
  SheetMatcherAvailability,
  SheetMatcherContext,
} from '@core/sheet-matchers/domain/SheetMatcher';
import { TAG_METADATA, type UserFacingTagName } from '@core/tagging/domain/TagName';

export interface TagSheetMatcherParams {
  /** Semantic tag name to match. `null` only when the document carries no user-facing tags. */
  readonly tagName: UserFacingTagName | null;
}

/**
 * Identifiers for the conditions that block this matcher. The dialog
 * maps each one to a user-facing message; codes here stay free of UI
 * copy so the core can change wording without changing logic.
 *
 * `no-tags` — no word in the document carries a user-facing semantic
 * tag; the matcher has nothing to discriminate by.
 */
export type TagSheetMatcherUnavailableCode = 'no-tags';

/**
 * Matches the words carrying the given semantic tag. Word granularity
 * on purpose: taggers mark spans — one emphasis word, a quoted phrase —
 * so only the tagged words move to the target sheet while the rest of
 * each scene stays behind, mirroring how the auto-created sheets
 * partition at preprocessing time. Only user-facing tag names (present
 * in `TAG_METADATA`) are enumerated; platform-internal tags like `cut`
 * never reach the picker.
 */
export class TagSheetMatcher implements WordSheetMatcher<TagSheetMatcherParams> {
  readonly type = 'tag';
  readonly label = 'By tag';
  readonly granularity = 'word' as const;

  availability(ctx: SheetMatcherContext): SheetMatcherAvailability {
    if (this.collectTagNames(ctx.document).length === 0) {
      return { available: false, code: 'no-tags' satisfies TagSheetMatcherUnavailableCode };
    }
    return { available: true };
  }

  defaultParams(ctx: SheetMatcherContext): TagSheetMatcherParams {
    const names = this.collectTagNames(ctx.document);
    return { tagName: names[0] ?? null };
  }

  matchesWord(word: Word, params: TagSheetMatcherParams): boolean {
    if (params.tagName === null) return false;
    return word.hasTagName(params.tagName);
  }

  /**
   * Distinct user-facing semantic tag names carried by the document's
   * words, in order of first appearance. Public because the tag picker
   * in the dialog enumerates it to populate its options.
   */
  collectTagNames(document: Document): UserFacingTagName[] {
    const seen = new Set<UserFacingTagName>();
    const ordered: UserFacingTagName[] = [];
    for (const segment of document.getSegments()) {
      for (const word of segment.getWords()) {
        for (const tag of word.semanticTags) {
          const name = tag.name;
          if (!this._isUserFacing(name) || seen.has(name)) continue;
          seen.add(name);
          ordered.push(name);
        }
      }
    }
    return ordered;
  }

  private _isUserFacing(name: string): name is UserFacingTagName {
    return name in TAG_METADATA;
  }
}
