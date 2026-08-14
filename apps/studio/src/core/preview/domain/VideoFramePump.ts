/**
 * Decodes video frames from the loaded source and paints them onto
 * the presentation surface at their scheduled output time.
 *
 * One continuous task runs at a time. `startFromOutputTime` cancels
 * any in-flight task and starts a fresh decode from the requested
 * output position. `paintSingleFrameAt` pulls one frame at a paused
 * position without starting a continuous loop.
 *
 * `paintNoFurtherThan` holds the picture at an output position: no
 * frame scheduled past it is painted, whatever the clock says, and
 * `null` lifts the limit again.
 *
 * Scrub session: `beginScrubSession` opens a persistent decoder
 * dedicated to drag interaction. While the session is open,
 * `paintScrubFrameAt` pushes the latest target through that
 * single decoder instead of opening a fresh one per tick.
 * `endScrubSession` closes the decoder; the final pushed target's
 * frame lands on screen as part of that teardown.
 */
export interface VideoFramePump {
  startFromOutputTime(outputSec: number): void;
  cancel(): void;
  paintNoFurtherThan(outputSec: number | null): void;
  paintSingleFrameAt(outputSec: number): Promise<void>;
  beginScrubSession(): void;
  paintScrubFrameAt(outputSec: number): void;
  endScrubSession(): void;
}
