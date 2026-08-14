// The snap reaches about as far as the handle being dragged is wide
// (`w-2`), so it never pulls from further away than the thing under
// the pointer.
const SNAP_TOLERANCE_PX = 8;

/**
 * Pulls a dragged time onto a nearby landmark — the edge of a
 * neighbouring word, the start or end of a scene — so landing flush
 * against something is the easy outcome rather than a pixel-hunt.
 *
 * The reach is expressed in pixels and converted through the caller's
 * scale, not written in seconds. A row can span half a second or half
 * a minute, and a tolerance in seconds would be an invisible nudge on
 * one and a magnet across half the track on the other.
 */
export class TimelineSnapResolver {

  /**
   * The nearest candidate within reach of `proposedSec`, or
   * `proposedSec` untouched when none is. `secondsPerPixel` is the
   * scale of the surface the pointer is moving over; a scale that is
   * zero or unknown disables snapping rather than guessing.
   */
  snap(proposedSec: number, candidatesSec: ReadonlyArray<number>, secondsPerPixel: number): number {
    if (!Number.isFinite(secondsPerPixel) || secondsPerPixel <= 0) return proposedSec;
    let closestSec = proposedSec;
    let closestDistanceSec = SNAP_TOLERANCE_PX * secondsPerPixel;
    for (const candidateSec of candidatesSec) {
      const distanceSec = Math.abs(candidateSec - proposedSec);
      if (distanceSec > closestDistanceSec) continue;
      closestDistanceSec = distanceSec;
      closestSec = candidateSec;
    }
    return closestSec;
  }
}
