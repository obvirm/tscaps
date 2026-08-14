import { CssVariable } from '@tscaps/engine';
import {
  ANIMATED_KIND_BY_SCOPE,
  type ElementAnimationScope,
} from '@core/elements/domain/ElementAnimationScope';
import type { ElementKind } from '@core/elements/domain/ElementKind';

const TIMING_VARIABLE_BY_KIND: Readonly<Record<ElementKind, CssVariable>> = {
  segment: CssVariable.SEGMENT_STARTS,
  line: CssVariable.LINE_BEING_NARRATED_STARTS,
  word: CssVariable.WORD_BEING_NARRATED_STARTS,
  // A decoration carries the timing of the word it belongs to, whether
  // it is painted inside that word or promoted out of it.
  decoration: CssVariable.WORD_BEING_NARRATED_STARTS,
};

/**
 * The variable an element's animation anchors to.
 *
 * Every state exposes a start, an end and a duration; this names the one
 * an animation usually wants — the moment the thing being animated
 * begins to matter. Others stay available to anyone who knows to ask for
 * them.
 *
 * A scope names what moves, so it also names whose clock it moves on: an
 * animation given to the words inside a caption runs on each word's own
 * clock, which is what makes them arrive one after another instead of
 * together with the caption.
 */
export class ElementTimingVariableResolver {
  resolve(kind: ElementKind, scope: ElementAnimationScope): string {
    return TIMING_VARIABLE_BY_KIND[ANIMATED_KIND_BY_SCOPE[scope] ?? kind];
  }
}
