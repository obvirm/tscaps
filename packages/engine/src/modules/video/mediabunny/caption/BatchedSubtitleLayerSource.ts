import type { Document } from '@modules/document/Document';
import type {
  SubtitleFrame,
  SubtitleFrameRenderer,
  SubtitleStyle,
} from '@modules/rendering/SubtitleFrameRenderer';
import type {
  SubtitleLayerRequest,
  SubtitleLayerSource,
} from '@modules/video/mediabunny/caption/SubtitleLayerSource';

// How much video one chunk may cover. The batch usually ends long
// before this, at the first tick whose picture its sheet cannot hold;
// what this decides is the other end, where the captions hold so still
// that the sheet never fills. There a longer reach is strictly better
// value — a caption still for 25 s spans three sheets at 10 and one at
// 30 — so this is a ceiling on the saving, and it is a judgement rather
// than a measurement: long enough that a caption rarely outlives it,
// short enough that one step stays a slice a caller can wait for, since
// planning and rendering block until the chunk is done and the frames it
// hands back are held until the next one.
//
// Bounded whatever the video: caption ticks are capped at 30/s, so a
// chunk never exceeds 300 of them, and a longer video only means more
// chunks.
const MAX_CHUNK_SECONDS = 10;

/**
 * `SubtitleLayerSource` that renders ahead in chunks, amortizing the
 * fixed cost of a batch fetch across many video frames. The decoded
 * video frame carried by each request is ignored.
 *
 * A chunk is as long as the renderer's batch reaches, which is decided
 * by how many distinct pictures the captions need rather than by a
 * frame count: a caption that holds still is one picture, however many
 * frames sit on it. So the source offers a whole look-ahead of ticks
 * and advances by what came back.
 *
 * Picks the right strategy for sections whose stylesheets are
 * independent of the underlying video pixels.
 *
 * Times handed to `framesFor` are expected to land on a caption tick
 * (a multiple of the `captionInterval` supplied at `open`); the
 * source rounds to absorb the FP roundtrip but does not snap from
 * arbitrary timestamps.
 */
export class BatchedSubtitleLayerSource implements SubtitleLayerSource {

  private captionInterval = 0;
  private lookAheadTicks = 0;
  private currentChunkFirstIdx = 0;
  private currentChunkFrames: ReadonlyArray<SubtitleFrame | null> = [];
  private opened = false;

  constructor(private readonly subtitleRenderer: SubtitleFrameRenderer) {}

  async open(
    doc: Document,
    styles: Readonly<Record<string, SubtitleStyle>>,
    width: number,
    height: number,
    captionInterval: number,
  ): Promise<void> {
    await this.subtitleRenderer.open(doc, styles, width, height);
    this.captionInterval = captionInterval;
    // Never below the pictures a batch can hold: offering fewer ticks
    // than that would cut a batch the renderer had room to fill.
    this.lookAheadTicks = Math.max(
      await this.subtitleRenderer.getMaxTilesPerBatch(),
      Math.ceil(MAX_CHUNK_SECONDS / captionInterval),
    );
    // An empty resident chunk starting at 0: the first `frameAt`
    // call's while-condition fires one `loadNextChunk`, which leaves
    // it where it starts and fills it.
    this.currentChunkFirstIdx = 0;
    this.currentChunkFrames = [];
    this.opened = true;
  }

  /**
   * One, because the look-ahead this source lives on is its own: it
   * reaches forward in document time, which needs no video frame and
   * therefore nothing gathered by the caller.
   */
  lookAhead(): number {
    return 1;
  }

  async framesFor(requests: ReadonlyArray<SubtitleLayerRequest>): Promise<Array<SubtitleFrame | null>> {
    const frames: Array<SubtitleFrame | null> = [];
    for (const request of requests) {
      frames.push(await this.frameAt(request.time));
    }
    return frames;
  }

  private async frameAt(time: number): Promise<SubtitleFrame | null> {
    if (!this.opened) return null;
    const captionIdx = Math.round(time / this.captionInterval);
    while (captionIdx >= this.currentChunkFirstIdx + this.currentChunkFrames.length) {
      await this.loadNextChunk();
    }
    return this.currentChunkFrames[captionIdx - this.currentChunkFirstIdx] ?? null;
  }

  close(): void {
    this.subtitleRenderer.close();
    this.currentChunkFrames = [];
    this.opened = false;
  }

  private async loadNextChunk(): Promise<void> {
    this.currentChunkFirstIdx += this.currentChunkFrames.length;
    const timestamps: number[] = [];
    for (let i = 0; i < this.lookAheadTicks; i++) {
      // Each timestamp is freshly computed from its absolute index
      // to avoid floating-point accumulation drift across long videos.
      timestamps.push((this.currentChunkFirstIdx + i) * this.captionInterval);
    }
    this.currentChunkFrames = await this.subtitleRenderer.getFrames(timestamps);
    if (this.currentChunkFrames.length === 0) {
      // Nothing to advance by: `frameAt` would ask again forever.
      throw new Error('Subtitle renderer returned no frames for a non-empty batch.');
    }
  }
}
