import type { AudioSample } from 'mediabunny';

/**
 * Consumes mediabunny {@link AudioSample}s in source order, downmixes
 * each to mono, and writes resampled frames into a caller-owned target
 * buffer at monotonically increasing offsets.
 *
 * Batches source-rate frames in a fixed-size internal buffer so the
 * whole track never sits in memory at once. Each full batch is
 * resampled through a fresh `OfflineAudioContext` and copied straight
 * into the target — a track of any length peaks at one batch worth of
 * source-rate PCM plus the target buffer, instead of the full-track
 * source-rate buffer the collect-then-resample approach needed. On a
 * 60-minute 48 kHz mono source that is ~5.7 MB per batch instead of
 * ~690 MB across the whole run.
 *
 * The source sample rate is discovered on the first appended sample —
 * `AudioSample.sampleRate` is stable across a single mediabunny track.
 * The target sample rate is fixed at construction. When the two match
 * the batch bypasses `OfflineAudioContext` and is copied verbatim.
 *
 * The target buffer is written up to its own capacity; any tail beyond
 * that is silently discarded, so the caller's pre-size determines the
 * ceiling. `flush` returns the actual number of frames written and the
 * caller can `subarray(0, written)` to trim any pre-sizing slack.
 */
export class BatchedMonoResampler {

  private static readonly BATCH_SECONDS = 30;

  private batch: Float32Array = new Float32Array(0);
  private batchFrames = 0;
  private sourceSampleRate = 0;
  private channelScratch: Float32Array = new Float32Array(0);
  private targetOffset = 0;

  constructor(
    private readonly target: Float32Array,
    private readonly targetSampleRate: number,
  ) {}

  async append(sample: AudioSample): Promise<void> {
    if (this.sourceSampleRate === 0) this.initFromFirstSample(sample);
    const frames = sample.numberOfFrames;
    if (frames === 0) return;
    this.ensureBatchCapacityFor(this.batchFrames + frames);
    this.mixSampleIntoBatch(sample, this.batchFrames);
    this.batchFrames += frames;
    if (this.batchFrames >= this.batch.length) await this.emitBatch();
  }

  async flush(): Promise<number> {
    if (this.batchFrames > 0) await this.emitBatch();
    return this.targetOffset;
  }

  private initFromFirstSample(sample: AudioSample): void {
    this.sourceSampleRate = sample.sampleRate;
    this.batch = new Float32Array(this.sourceSampleRate * BatchedMonoResampler.BATCH_SECONDS);
  }

  private ensureBatchCapacityFor(needed: number): void {
    if (this.batch.length >= needed) return;
    const grown = new Float32Array(needed);
    grown.set(this.batch.subarray(0, this.batchFrames));
    this.batch = grown;
  }

  private async emitBatch(): Promise<void> {
    const source = this.batch.subarray(0, this.batchFrames);
    const resampled = this.sourceSampleRate === this.targetSampleRate
      ? source
      : await this.resampleBatch(source);
    this.writeIntoTarget(resampled);
    this.batchFrames = 0;
  }

  private async resampleBatch(source: Float32Array): Promise<Float32Array> {
    const targetFrames = Math.max(1, Math.ceil(source.length * this.targetSampleRate / this.sourceSampleRate));
    const ctx = new OfflineAudioContext(1, targetFrames, this.targetSampleRate);
    const buffer = ctx.createBuffer(1, source.length, this.sourceSampleRate);
    buffer.getChannelData(0).set(source);
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);
    node.start();
    const rendered = await ctx.startRendering();
    return rendered.getChannelData(0);
  }

  private writeIntoTarget(source: Float32Array): void {
    const room = this.target.length - this.targetOffset;
    if (room <= 0) return;
    const writeLen = Math.min(source.length, room);
    this.target.set(source.subarray(0, writeLen), this.targetOffset);
    this.targetOffset += writeLen;
  }

  private mixSampleIntoBatch(sample: AudioSample, writeOffset: number): void {
    const frames = sample.numberOfFrames;
    const channels = sample.numberOfChannels;
    const target = this.batch.subarray(writeOffset, writeOffset + frames);

    if (channels <= 1) {
      sample.copyTo(target, { planeIndex: 0, format: 'f32-planar' });
      return;
    }

    if (this.channelScratch.length < frames) this.channelScratch = new Float32Array(frames);
    const scratch = this.channelScratch.subarray(0, frames);
    sample.copyTo(target, { planeIndex: 0, format: 'f32-planar' });
    for (let channel = 1; channel < channels; channel += 1) {
      sample.copyTo(scratch, { planeIndex: channel, format: 'f32-planar' });
      for (let frame = 0; frame < frames; frame += 1) target[frame]! += scratch[frame]!;
    }
    const inverseChannels = 1 / channels;
    for (let frame = 0; frame < frames; frame += 1) target[frame]! *= inverseChannels;
  }
}
