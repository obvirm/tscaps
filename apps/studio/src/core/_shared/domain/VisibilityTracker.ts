/**
 * Watches whether the page stayed visible across a span of work.
 *
 * `begin()` opens a span; the span accumulates until `end()` removes
 * its listener. Reading `wasHidden` before `end()` is valid — it
 * reports what has been observed so far.
 */
export interface VisibilityTracker {
  begin(): VisibilitySpan;
}

export interface VisibilitySpan {
  /** True when the page was hidden at any moment since `begin()`. */
  readonly wasHidden: boolean;
  /** The page's visibility state right now (`'visible'` / `'hidden'`). */
  readonly currentState: string;
  /** Stops observing. Idempotent. */
  end(): void;
}
