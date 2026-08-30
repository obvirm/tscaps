import type { Document, Word } from '@tscaps/engine';
import type {
  SheetMatcherAvailability,
  SheetMatcherContext,
  WordSheetMatcher,
} from '@core/sheet-matchers/domain/SheetMatcher';

export interface SpeakerSheetMatcherParams {
  /** Speaker id to match. `null` targets words without speaker attribution. */
  readonly speakerId: string | null;
}

/**
 * Identifiers for the conditions that block this matcher. The dialog
 * maps each one to a user-facing message; codes here stay free of UI
 * copy so the core can change wording without changing logic.
 *
 * `insufficient-speakers` — fewer than two distinct speakers detected;
 * the matcher has nothing meaningful to discriminate by.
 */
export type SpeakerSheetMatcherUnavailableCode = 'insufficient-speakers';

/**
 * Matches the words one speaker says. Word granularity, like the tag
 * matcher: a scene two voices share is carved between them rather than
 * refused, and each side is re-split under its own sheet's rules
 * afterwards. Nothing has to be tidy before this runs.
 */
export class SpeakerSheetMatcher implements WordSheetMatcher<SpeakerSheetMatcherParams> {
  readonly type = 'speaker';
  readonly label = 'By speaker';
  readonly cloudOnly = true;
  readonly granularity = 'word' as const;

  availability(ctx: SheetMatcherContext): SheetMatcherAvailability {
    const speakerIds = this.collectSpeakerIds(ctx.document);
    if (speakerIds.length < 2) {
      return { available: false, code: 'insufficient-speakers' satisfies SpeakerSheetMatcherUnavailableCode };
    }
    return { available: true };
  }

  defaultParams(ctx: SheetMatcherContext): SpeakerSheetMatcherParams {
    const ids = this.collectSpeakerIds(ctx.document);
    return { speakerId: ids[0] ?? null };
  }

  matchesWord(word: Word, params: SpeakerSheetMatcherParams): boolean {
    return word.speakerId === params.speakerId;
  }

  /**
   * Distinct speaker ids carried by the document's words, in order of
   * first appearance. `null` (words without speaker attribution) is
   * preserved as an explicit entry so it can be targeted by the matcher.
   * Public because the speaker picker in the dialog enumerates it to
   * populate its options.
   */
  collectSpeakerIds(document: Document): (string | null)[] {
    const seen = new Set<string | null>();
    const ordered: (string | null)[] = [];
    for (const segment of document.getSegments()) {
      for (const word of segment.getWords()) {
        if (seen.has(word.speakerId)) continue;
        seen.add(word.speakerId);
        ordered.push(word.speakerId);
      }
    }
    return ordered;
  }
}
