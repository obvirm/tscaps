import type { TextDirection } from '@modules/bidi/TextDirection';

/**
 * Outcome of the Unicode bidirectional algorithm over one stretch of
 * text. Both arrays are indexed by UTF-16 unit and have the same length
 * as the analyzed string.
 */
export interface BidiAnalysis {
  /** Resolved embedding level of each unit, in source order. */
  readonly levels: ReadonlyArray<number>;
  /** Source index of each unit, ordered as the text paints from left to right. */
  readonly visualOrder: ReadonlyArray<number>;
}

/**
 * Resolves the Unicode bidirectional algorithm (UAX #9) for a text.
 *
 * `baseDirection` is required rather than inferred from the text: the
 * standard's own fallback picks the direction of the first strong
 * character, which misreads a sentence opening with a foreign name.
 */
export interface BidiAnalyzer {
  analyze(text: string, baseDirection: TextDirection): BidiAnalysis;
}
