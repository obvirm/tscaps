import { memo, useLayoutEffect } from 'react';
import type { Decoration, Segment, Word } from '@tscaps/engine';
import { useOverlayManipulationController } from '@ui/pages/editor/features/overlay/contexts/OverlayManipulationContext';
import { useBoundDecoration } from '@ui/pages/editor/features/overlay/hooks/useOverlayBinding';
import { CAPTION_ELEMENT_ID_ATTRIBUTE } from '@presentation/editor/services/CaptionElementAttribute';

const WORD_DECORATION_CSS_CLASS = 'word-decoration';

interface WordDecorationSpanProps {
  decoration: Decoration;
  /** Home segment of the host word — supplies both the drop-back-to-flow target id and the ancestor time window for the engine bindings. */
  segment: Segment;
  /** Host word, supplies the fallback time window when the decoration has no `customTime`. */
  word: Word;
}

export const WordDecorationSpan = memo(function WordDecorationSpan({
  decoration,
  segment,
  word,
}: WordDecorationSpanProps) {
  const manipulation = useOverlayManipulationController();
  const ref = useBoundDecoration(decoration, segment, word);

  useLayoutEffect(() => {
    const span = ref.current;
    if (!span) return;
    return manipulation.bindWord({ wordId: decoration.id, segmentId: segment.id, span });
  }, [manipulation, decoration.id, segment.id, ref]);

  return (
    <span
      ref={ref}
      className={WORD_DECORATION_CSS_CLASS}
      data-tscaps-word-id={decoration.id}
      {...{ [CAPTION_ELEMENT_ID_ATTRIBUTE]: decoration.id }}
    >
      {decoration.glyph}
    </span>
  );
});
