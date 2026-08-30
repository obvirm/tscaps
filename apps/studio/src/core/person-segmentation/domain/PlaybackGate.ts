/**
 * The playback surface, as much of it as the detector needs: a way to
 * stop the video where it stands, resume it, and ask which of the two
 * it was doing. Held as a contract so nothing in the detector's path
 * has to know how the preview plays anything.
 */
export interface PlaybackGate {
  play(): Promise<void>;
  pause(): void;
  isPlaying(): boolean;
}
