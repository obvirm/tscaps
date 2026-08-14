import { WaveformScale } from '@presentation/timeline/services/WaveformScale';

/**
 * Works out how a video's peaks should be scaled to fill the track,
 * once, from the whole envelope.
 *
 * It has to be the whole video. Resolving per row would make every row
 * its own reference, so a whispered row would draw as tall as a shouted
 * one and the bars would jump while scrolling — and telling loud from
 * quiet is most of what the waveform is read for.
 */
export class WaveformScaleResolver {

  /**
   * @param referenceFraction the share of peaks that must fit under the
   * top of the track; the rest clip. An order statistic rather than the
   * maximum, because a peak is the loudest sample in a 10 ms bucket and
   * a single click, mic bump or plosive owns that bucket outright. On a
   * quietly recorded track one 5 ms click was measured to cost 16x of
   * the available gain, which is worst precisely on the poor recordings
   * this exists for.
   * @param floorFraction the share of peaks taken to be the noise floor
   * rather than content.
   * @param maxFloorHeight how tall that floor may end up drawn. Without
   * it a video of nothing but room tone earns unbounded gain and fills
   * the track, which reads as speech and is worse than a flat line.
   * Stated as drawn height rather than as an amplitude so it assumes
   * nothing about how anything was recorded. This is the value at which
   * it stops binding on quiet speech and only catches tracks that carry
   * no speech at all.
   */
  constructor(
    private readonly referenceFraction: number = 0.95,
    private readonly floorFraction: number = 0.10,
    private readonly maxFloorHeight: number = 0.10,
  ) {}

  resolve(peaks: Float32Array): WaveformScale {
    if (peaks.length === 0) return new WaveformScale(1);
    const sorted = peaks.slice().sort();
    const reference = this.percentile(sorted, this.referenceFraction);
    if (reference <= 0) return new WaveformScale(1);
    const floor = this.percentile(sorted, this.floorFraction);
    return new WaveformScale(Math.min(1 / reference, this.gainKeepingFloorDown(floor)));
  }

  private gainKeepingFloorDown(floor: number): number {
    return floor > 0 ? this.maxFloorHeight / floor : Infinity;
  }

  private percentile(sorted: Float32Array, fraction: number): number {
    return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))] ?? 0;
  }
}
