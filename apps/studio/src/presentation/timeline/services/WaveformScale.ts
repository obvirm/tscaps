/**
 * Turns a raw audio peak into the height its bar is drawn at, both in
 * `[0, 1]`.
 *
 * One gain for the whole recording, so every bar keeps its size
 * relative to every other. A curve expanding the quiet end was tried
 * and is the wrong shape for this: it lifts breaths and room noise
 * towards the speech it is meant to separate them from.
 *
 * Nothing here claims to report loudness. The waveform is read to find
 * where the words are, and the panel says nothing about decibels.
 */
export class WaveformScale {

  constructor(private readonly gain: number) {}

  heightOf(peak: number): number {
    return Math.min(1, peak * this.gain);
  }
}
