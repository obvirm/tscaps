/**
 * Writes an in-flight drag offset onto one element. Keeps the
 * per-pointermove DOM mutation in one place and out of React's render
 * path. Which elements move, and how far each of them travels, is the
 * caller's call — a single gesture can move several elements by
 * different offsets; this class only paints.
 *
 * Uses `position: relative` + `top`/`left` rather than `transform`
 * for two reasons: (1) `transform` creates a new stacking context on
 * the target, which traps any `mix-blend-mode` it carries and breaks
 * the blend against the underlying video (the word goes invisible
 * for blend modes like `multiply`); (2) without a `z-index`,
 * `position: relative` does NOT create a stacking context, so the
 * blend keeps working through the drag. All three properties are
 * written with `!important` to win against template animations or
 * cascade rules that target the same element class.
 */
export class DragTransformPainter {
  applyTranslate(target: HTMLElement, deltaX: number, deltaY: number): void {
    target.style.setProperty('position', 'relative', 'important');
    target.style.setProperty('top', `${deltaY}px`, 'important');
    target.style.setProperty('left', `${deltaX}px`, 'important');
  }

  clear(target: HTMLElement): void {
    target.style.removeProperty('position');
    target.style.removeProperty('top');
    target.style.removeProperty('left');
  }
}
