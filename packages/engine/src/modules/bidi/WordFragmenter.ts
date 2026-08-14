import type { BidiAnalysis, BidiAnalyzer } from '@modules/bidi/BidiAnalyzer';
import type { CursiveScriptDetector } from '@modules/bidi/CursiveScriptDetector';
import type { TextDirection } from '@modules/bidi/TextDirection';
import type { WordFragment } from '@modules/bidi/WordFragment';

const WORD_SEPARATOR = ' ';
const SEPARATOR_OWNER = -1;

/** A fragment before it is known whether it is the last one of its word. */
type UntailedFragment = Omit<WordFragment, 'carriesWordTail'>;

/** A stretch of one word holding a single embedding level, as a slice of the joined line text. */
interface LevelRun {
  readonly wordIndex: number;
  readonly start: number;
  /** Exclusive. */
  readonly end: number;
  readonly level: number;
}

/**
 * Lays the words of a single line out in the order they paint, splitting
 * any word that spans more than one bidi embedding level.
 *
 * Words arrive in spoken order and every fragment carries the index of
 * the word it came from, so timing, tags and per-word styling stay
 * attached to their word wherever its fragments land.
 *
 * A line of one script yields one fragment per word, in the same order
 * or its exact reverse. Mixed scripts interleave, and a word whose
 * punctuation resolves away from its letters splits in two that can end
 * up at opposite ends of the line.
 */
export class WordFragmenter {

  constructor(
    private readonly bidiAnalyzer: BidiAnalyzer,
    private readonly cursiveScriptDetector: CursiveScriptDetector,
  ) {}

  /**
   * Fragments of every word that has characters, ordered left to right
   * as they paint. A word with no characters paints nothing and yields
   * no fragment.
   *
   * The words are analyzed together as one line, because the direction
   * the algorithm resolves for a word depends on the words around it.
   */
  fragment(words: ReadonlyArray<string>, baseDirection: TextDirection): ReadonlyArray<WordFragment> {
    if (words.length === 0) return [];
    const text = words.join(WORD_SEPARATOR);
    const analysis = this.bidiAnalyzer.analyze(text, baseDirection);
    const runs = this.splitIntoLevelRuns(words, analysis);
    return this.markWordTails(this.walkPaintOrder(runs, analysis, text));
  }

  private splitIntoLevelRuns(words: ReadonlyArray<string>, analysis: BidiAnalysis): LevelRun[] {
    const runs: LevelRun[] = [];
    let cursor = 0;
    words.forEach((word, wordIndex) => {
      runs.push(...this.splitWordIntoLevelRuns(wordIndex, cursor, word.length, analysis));
      cursor += word.length + WORD_SEPARATOR.length;
    });
    return runs;
  }

  private splitWordIntoLevelRuns(
    wordIndex: number,
    start: number,
    length: number,
    analysis: BidiAnalysis,
  ): LevelRun[] {
    const runs: LevelRun[] = [];
    const end = start + length;
    let runStart = start;
    for (let i = start; i < end; i++) {
      const level = analysis.levels[i]!;
      if (i + 1 === end || analysis.levels[i + 1] !== level) {
        runs.push({ wordIndex, start: runStart, end: i + 1, level });
        runStart = i + 1;
      }
    }
    return runs;
  }

  /**
   * A run holds one level over consecutive characters, so its characters
   * paint consecutively too: reading the visual order once yields every
   * run exactly once, already in the order they appear on screen.
   */
  private walkPaintOrder(
    runs: ReadonlyArray<LevelRun>,
    analysis: BidiAnalysis,
    text: string,
  ): UntailedFragment[] {
    const ownerOf = this.buildRunOwnership(runs, text.length);
    const fragments: UntailedFragment[] = [];
    let previousOwner = SEPARATOR_OWNER;
    let separatorSeenSinceLastRun = false;

    for (const sourceIndex of analysis.visualOrder) {
      const owner = ownerOf[sourceIndex] ?? SEPARATOR_OWNER;
      if (owner === SEPARATOR_OWNER) {
        separatorSeenSinceLastRun = true;
      } else if (owner !== previousOwner) {
        const run = runs[owner]!;
        const fragmentText = text.slice(run.start, run.end);
        fragments.push({
          wordIndex: run.wordIndex,
          text: fragmentText,
          direction: this.directionOfLevel(run.level),
          joinedToPrevious: fragments.length > 0 && !separatorSeenSinceLastRun,
          charactersJoin: this.cursiveScriptDetector.isCursive(fragmentText),
        });
        separatorSeenSinceLastRun = false;
      }
      previousOwner = owner;
    }
    return fragments;
  }

  private markWordTails(fragments: ReadonlyArray<UntailedFragment>): WordFragment[] {
    const lastFragmentOfWord = new Map<number, number>();
    fragments.forEach((fragment, index) => lastFragmentOfWord.set(fragment.wordIndex, index));
    return fragments.map((fragment, index) => ({
      ...fragment,
      carriesWordTail: lastFragmentOfWord.get(fragment.wordIndex) === index,
    }));
  }

  private buildRunOwnership(runs: ReadonlyArray<LevelRun>, textLength: number): number[] {
    const ownerOf = new Array<number>(textLength).fill(SEPARATOR_OWNER);
    runs.forEach((run, runIndex) => {
      for (let i = run.start; i < run.end; i++) ownerOf[i] = runIndex;
    });
    return ownerOf;
  }

  private directionOfLevel(level: number): TextDirection {
    return level % 2 === 0 ? 'ltr' : 'rtl';
  }
}
