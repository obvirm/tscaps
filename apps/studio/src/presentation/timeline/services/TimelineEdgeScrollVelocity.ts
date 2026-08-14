// How deep into the panel the scroll band reaches. It has to sit
// inside the panel: a maximized window leaves nowhere below it to move
// the pointer to, so a band that only armed past the edge would be
// unreachable exactly when the window is full-screen. Deep enough to
// aim at with a mouse, shallower than a row so it cannot arm while the
// pointer is still working on one.
const TRIGGER_BAND_PX = 64;

// Speed at the panel's edge. The band ramps up to it from zero, and
// past the edge it stays there.
const MAX_SPEED_PX_PER_SEC = 1200;

/**
 * How fast the timeline should scroll itself while a drag holds the
 * pointer against one of the panel's edges.
 *
 * The last stretch before each edge is a scroll band. Speed ramps
 * linearly from nothing at the band's inner boundary to full speed at
 * the edge itself, and holds there if the pointer goes further out.
 * The ramp is what keeps the band from fighting the user: drifting
 * barely inside it creeps, so a drag that merely ends up near the
 * bottom of the panel is not yanked away.
 */
export class TimelineEdgeScrollVelocity {

  /** Pixels per second: negative scrolls up, positive down, zero holds still. */
  forPointer(clientY: number, viewportTopPx: number, viewportBottomPx: number): number {
    return this.approach(clientY, viewportTopPx, viewportBottomPx) * MAX_SPEED_PX_PER_SEC;
  }

  /** Signed 0..1 measure of how far the pointer is into a scroll band. */
  private approach(clientY: number, viewportTopPx: number, viewportBottomPx: number): number {
    // A panel too short to hold two bands would have them overlap, and
    // every position would read as "scroll down".
    const band = Math.min(TRIGGER_BAND_PX, (viewportBottomPx - viewportTopPx) / 2);
    if (band <= 0) return 0;
    const pastBottom = clientY - (viewportBottomPx - band);
    if (pastBottom > 0) return Math.min(1, pastBottom / band);
    const pastTop = clientY - (viewportTopPx + band);
    if (pastTop < 0) return Math.max(-1, pastTop / band);
    return 0;
  }
}
