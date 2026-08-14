/**
 * The frozen-frame contract expressed as CSS: the two animation
 * longhands that make a rendered frame a function of the playhead
 * instead of of wall-clock time.
 *
 * A frame is produced by seeking every animation with a negative
 * `animation-delay` and reading the result, which needs both halves to
 * hold on every element. The pause keeps an animation from advancing
 * on its own. The fill makes an element outside its animation's active
 * window paint from the keyframes rather than falling back to its
 * unanimated state — without it an element renders its resting style
 * before its moment arrives, and snaps into the `from` keyframe when
 * it does.
 *
 * Both are `!important` because an `animation:` shorthand resets every
 * longhand it omits: as plain declarations they would apply or not
 * depending on whether a stylesheet happened to use the shorthand.
 * Neither is a style choice a stylesheet may make — `from` and `to`
 * are where a stylesheet expresses what it wants each phase to look
 * like.
 *
 * The selector is deliberately unqualified. A consumer rendering into
 * a document of its own applies it as-is; one rendering into a shared
 * document runs it through {@link CssScoper} first, or it will freeze
 * every animation on the page.
 */
export const FROZEN_FRAME_CSS = '*, *::before, *::after { animation-play-state: paused !important; animation-fill-mode: both !important; }';
