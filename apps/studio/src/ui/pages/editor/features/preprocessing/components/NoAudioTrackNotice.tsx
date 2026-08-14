/**
 * Tells the visitor the loaded video has no audio track. Starting is
 * still allowed — the pipeline skips transcription and opens the
 * editor with an empty transcript — so the notice sets that
 * expectation before they commit.
 */
export function NoAudioTrackNotice() {
  return (
    <div
      data-testid="no-audio-track-notice"
      className="rounded-sm border border-warning/40 bg-warning/10 p-3"
    >
      <p className="text-xs text-fg-primary leading-snug m-0">
        This video has no audio track, so there is no speech to transcribe.
        You can still open the editor and add captions by hand.
      </p>
    </div>
  );
}
