import type { ReactNode } from 'react';

const DESKTOP_THRESHOLD_SECONDS = 10 * 60;
const MOBILE_THRESHOLD_SECONDS = 2 * 60;

interface LongVideoWarningProps {
  readonly videoDurationSeconds: number;
  readonly isMobile: boolean;
  readonly cta?: ReactNode;
}

/**
 * Warns the visitor before they commit that transcribing this video in
 * the browser will be slow. The threshold is lower on mobile because
 * inference there runs single-threaded on WASM (Safari lacks
 * cross-origin isolation) and typically takes several times the video
 * length. Below the threshold the component renders nothing.
 *
 * An optional `cta` slot renders below the warning copy, a place for a
 * "try a faster alternative" link where one exists.
 */
export function LongVideoWarning({ videoDurationSeconds, isMobile, cta }: LongVideoWarningProps) {
  if (!isLongVideo(videoDurationSeconds, isMobile)) return null;
  return (
    <div
      data-testid="long-video-warning"
      className="rounded-sm border border-warning/40 bg-warning/10 p-3 flex flex-col gap-2"
    >
      <p className="text-xs text-fg-primary leading-snug m-0">
        This video is <strong className="tabular-nums">{formatDuration(videoDurationSeconds)}</strong>.
        {' In-browser transcription can take a while. Now would be a good time to grab a coffee.'}
      </p>
      {cta}
    </div>
  );
}

export function isLongVideo(videoDurationSeconds: number, isMobile: boolean): boolean {
  const threshold = isMobile ? MOBILE_THRESHOLD_SECONDS : DESKTOP_THRESHOLD_SECONDS;
  return videoDurationSeconds > threshold;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const totalMin = Math.floor(seconds / 60);
  const sec = Math.round(seconds - totalMin * 60);
  if (totalMin < 60) return sec > 0 ? `${totalMin}m ${sec}s` : `${totalMin}m`;
  const hr = Math.floor(totalMin / 60);
  const remMin = totalMin - hr * 60;
  return remMin > 0 ? `${hr}h ${remMin}m` : `${hr}h`;
}
