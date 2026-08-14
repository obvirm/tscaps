import { memo, useMemo } from 'react';
import { WaveformBarsProjection } from '@presentation/timeline/services/WaveformBarsProjection';
import type { WaveformScale } from '@presentation/timeline/services/WaveformScale';

interface WaveformProps {
  peaks: Float32Array;
  peaksPerSecond: number;
  startSec: number;
  endSec: number;
  heightPx: number;
  /** Resolved for the whole recording, so rows stay comparable. */
  scale: WaveformScale;
}

const WAVEFORM_VIEWBOX_WIDTH = 1000;
const WAVEFORM_VIEWBOX_HEIGHT = 100;

/**
 * Renders a DAW-style bar-chart waveform for the slice of peaks
 * between `startSec` and `endSec`. The SVG stretches to fill the
 * parent's width and the height matches `heightPx`. Slicing and
 * downsampling are delegated to `WaveformBarsProjection`; this
 * view only translates the resulting bars into an SVG path.
 */
export const Waveform = memo(function Waveform({
  peaks,
  peaksPerSecond,
  startSec,
  endSec,
  heightPx,
  scale,
}: WaveformProps) {
  const projection = useMemo(() => new WaveformBarsProjection(), []);

  const bars = useMemo(
    () => projection.bars(peaks, peaksPerSecond, startSec, endSec, scale),
    [projection, peaks, peaksPerSecond, startSec, endSec, scale],
  );

  const path = useMemo(() => buildBarsPath(bars), [bars]);

  return (
    <svg
      className="block w-full"
      style={{ height: heightPx }}
      viewBox={`0 0 ${WAVEFORM_VIEWBOX_WIDTH} ${WAVEFORM_VIEWBOX_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {path && (
        <path d={path} fill="rgb(var(--color-waveform))" />
      )}
    </svg>
  );
});

function buildBarsPath(bars: Float32Array): string {
  const count = bars.length;
  if (count === 0) return '';
  const centerY = WAVEFORM_VIEWBOX_HEIGHT / 2;
  const halfHeight = WAVEFORM_VIEWBOX_HEIGHT / 2;
  // Min bar height keeps near-silent regions visible as a thin dot
  // instead of disappearing entirely.
  const minAmp = 0.02;
  // Each bar owns a slot of viewbox width and takes 75% of it, leaving
  // a 25% gap. The slot scales with bar count so visual density stays
  // consistent for short and long segments alike.
  const slotWidth = WAVEFORM_VIEWBOX_WIDTH / count;
  const barWidth = slotWidth * 0.75;
  const barOffset = (slotWidth - barWidth) / 2;
  const segments: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = i * slotWidth + barOffset;
    const amp = Math.max(minAmp, bars[i]!) * halfHeight;
    const top = centerY - amp;
    const height = amp * 2;
    segments.push(
      `M${x.toFixed(2)},${top.toFixed(2)}h${barWidth.toFixed(2)}v${height.toFixed(2)}h${(-barWidth).toFixed(2)}z`,
    );
  }
  return segments.join('');
}
