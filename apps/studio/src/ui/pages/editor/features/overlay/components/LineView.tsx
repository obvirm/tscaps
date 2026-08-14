import { memo, type CSSProperties } from 'react';
import type { Line, Segment, TextDirection, Word, WordFragmenter, WordSplitter } from '@tscaps/engine';
import { WordView } from '@ui/pages/editor/features/overlay/components/words/WordView';
import { useBoundLine } from '@ui/pages/editor/features/overlay/hooks/useOverlayBinding';
import { useDraggedWordId } from '@ui/pages/editor/features/overlay/hooks/useDraggedWordId';
import { CAPTION_ELEMENT_ID_ATTRIBUTE } from '@presentation/editor/services/CaptionElementAttribute';

interface LineViewProps {
  line: Line;
  segment: Segment;
  letterSplitter: WordSplitter | null;
  wordFragmenter: WordFragmenter;
  /** Paragraph direction the line's words are resolved against. */
  textDirection: TextDirection;
  /** Per-word `font-family` values keyed by word id. Words that inherit the cascade are absent. */
  wordFontFamilies: ReadonlyMap<string, string>;
  /** Decoration ids whose inline `<span>` should be omitted — the glyph either paints out of flow at its own anchor, or the emoji effect is disabled on the host sheet. */
  inlineSuppressedDecorationIds: ReadonlySet<string>;
  /** Words painted out of flow at their own anchor, so the line leaves a gap rather than a duplicate. */
  placedWordIds: ReadonlySet<string>;
}

interface VisibleWord {
  word: Word;
  indexInLine: number;
}

// `direction` is pinned because the words below are emitted already ordered
// the way they paint, and an inherited `rtl` would reverse a settled order.
// React must not set `className` on the element carrying this style — the
// overlay controller writes the time-driven class list there and would be
// clobbered on every React update if React owned the prop.
const LINE_LAYOUT_STYLE: CSSProperties = { direction: 'ltr' };

export const LineView = memo(function LineView({
  line,
  segment,
  letterSplitter,
  wordFragmenter,
  textDirection,
  wordFontFamilies,
  placedWordIds,
  inlineSuppressedDecorationIds,
}: LineViewProps) {
  const draggedWordId = useDraggedWordId();
  const visibleWords: VisibleWord[] = [];
  for (let i = 0; i < line.words.length; i++) {
    const word = line.words[i]!;
    if (placedWordIds.has(word.id)) continue;
    if (word.id === draggedWordId) continue;
    visibleWords.push({ word, indexInLine: i });
  }
  const fragments = wordFragmenter.fragment(
    visibleWords.map(({ word }) => word.displayText),
    textDirection,
  );
  const ref = useBoundLine(line, segment, visibleWords.length > 0);
  if (visibleWords.length === 0) return null;
  return (
    <div ref={ref} style={LINE_LAYOUT_STYLE} {...{ [CAPTION_ELEMENT_ID_ATTRIBUTE]: line.id }}>
      {fragments.map((fragment, index) => {
        const { word, indexInLine } = visibleWords[fragment.wordIndex]!;
        return (
          <WordView
            key={`${word.id}:${index}`}
            word={word}
            fragment={fragment}
            closeGapAfter={fragments[index + 1]?.joinedToPrevious ?? false}
            segment={segment}
            indexInLine={indexInLine}
            letterSplitter={letterSplitter}
            fontFamily={wordFontFamilies.get(word.id)}
            suppressInlineDecoration={
              !fragment.carriesWordTail || shouldSuppressInlineDecoration(word, inlineSuppressedDecorationIds)
            }
            carriesTrail={fragment.carriesWordTail}
          />
        );
      })}
    </div>
  );
});

function shouldSuppressInlineDecoration(word: Word, inlineSuppressedDecorationIds: ReadonlySet<string>): boolean {
  if (!word.decoration) return false;
  return inlineSuppressedDecorationIds.has(word.decoration.id);
}
