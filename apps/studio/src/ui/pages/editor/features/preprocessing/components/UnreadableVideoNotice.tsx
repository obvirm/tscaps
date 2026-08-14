/**
 * Tells the visitor the loaded file could not be read as a video.
 * Shown when probing settled without resolving a duration, so the
 * flow cannot continue with this file and the only way forward is a
 * different one.
 */
export function UnreadableVideoNotice() {
  return (
    <div
      data-testid="unreadable-video-notice"
      className="rounded-sm border border-danger/40 bg-danger/10 p-3"
    >
      <p className="text-xs text-fg-primary leading-snug m-0">
        We couldn't read this video. The file may be damaged or use a format
        this browser can't open. Try re-exporting it as MP4, or drop a
        different file.
      </p>
    </div>
  );
}
