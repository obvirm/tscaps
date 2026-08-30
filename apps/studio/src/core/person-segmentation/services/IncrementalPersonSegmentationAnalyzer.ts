import type { EditorStore } from '@core/editor/store/EditorStore';
import { AnalysisQueue } from '@core/person-segmentation/domain/AnalysisQueue';
import { PersonSegmentationPacing } from '@core/person-segmentation/domain/PersonSegmentationPacing';
import { PersonSegmentationThresholds } from '@core/person-segmentation/domain/PersonSegmentationThresholds';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';
import type { AnalyzeVideoRangesAction } from '@core/person-segmentation/actions/AnalyzeVideoRangesAction';
import type { PersonSegmentationCachePersister } from '@core/person-segmentation/services/PersonSegmentationCachePersister';
import type { PersonSegmentationResultReader } from '@core/person-segmentation/services/PersonSegmentationResultReader';
import type { PersonSegmentationSession } from '@core/person-segmentation/services/PersonSegmentationSession';
import type {
  ScanVideoSourceIdentity,
  ScanVideoSourceResolver,
} from '@core/person-segmentation/services/ScanVideoSourceResolver';

/**
 * Works a video's outstanding analysis off a chunk at a time, always
 * taking the chunk nearest whatever the viewer is looking at.
 *
 * Callers name the stretches that matter and say how much of an
 * answer they need: {@link ensureHeadStart} returns as soon as the
 * moment on screen is ready and leaves the rest to the background,
 * while {@link ensureCovered} waits for the whole of what was asked.
 * One video stays open across all of it, and closes when the work
 * runs out.
 *
 * A chunk that fails is put back rather than dropped, so the stretch
 * stays owed, and draining stops there instead of spinning on it —
 * which is why `ensureCovered` reports whether it got what it asked
 * for instead of resolving as though it had. The queue can be added to
 * at any time, including while a drain is running, and the next chunk
 * taken accounts for it.
 *
 * Everything owed belongs to one particular video. Swapping the video
 * under the editor drops it: a measurement of the file that is gone
 * answers nothing about the one that replaced it.
 */
export class IncrementalPersonSegmentationAnalyzer {
  private readonly queue = new AnalysisQueue();
  private worthMasking = TimeRangeSet.EMPTY;
  private analyzingVideo: ScanVideoSourceIdentity | null = null;
  private running: Promise<boolean> = Promise.resolve(false);
  private draining: Promise<void> | null = null;
  private stopped = false;

  constructor(
    private readonly editorStore: EditorStore,
    private readonly session: PersonSegmentationSession,
    private readonly analyzeRanges: AnalyzeVideoRangesAction,
    private readonly resultReader: PersonSegmentationResultReader,
    private readonly sourceResolver: ScanVideoSourceResolver,
    private readonly persister: PersonSegmentationCachePersister,
  ) {}

  /**
   * Takes on whatever of `ranges` has never been measured, measures
   * one chunk around the viewer, and leaves the rest to the background.
   * Resolves once the moment on screen is ready — not once the video
   * is. Rejects when that first chunk fails.
   */
  async ensureHeadStart(ranges: TimeRangeSet): Promise<void> {
    if (!await this.takeOnWhatIsMissing(ranges)) return;
    await this.analyzeNextChunk();
    void this.drain();
  }

  /**
   * Takes on whatever of `ranges` has never been measured and works
   * until nothing is owed, or until a chunk fails and the drain gives
   * up. Resolves to whether everything asked for ended up measured —
   * a caller that cannot show a partial answer has to look, since an
   * export burns one file and a stretch left unmeasured comes out of
   * it silently without the effect.
   */
  async ensureCovered(ranges: TimeRangeSet): Promise<boolean> {
    await this.takeOnWhatIsMissing(ranges);
    while (this.hasWorkLeft() && !this.stopped) {
      const owedBefore = this.queue.remaining().totalSeconds();
      await this.drain();
      // A drain stops at the chunk it could not measure rather than
      // spinning on it, so a round that moved nothing is the signal
      // that going round again would not move anything either.
      if (this.queue.remaining().totalSeconds() >= owedBefore) break;
    }
    return !this.hasWorkLeft();
  }

  /**
   * Adds stretches to what is waiting, as work for the video the
   * editor holds now. Stretches already waiting are not duplicated, and
   * anything owed for a video that has since been replaced is dropped.
   */
  request(ranges: TimeRangeSet): void {
    this.forgetWorkOwedForAReplacedVideo();
    this.stopped = false;
    this.queue.request(ranges);
  }

  /** Whether anything is still waiting to be measured. */
  hasWorkLeft(): boolean {
    return !this.queue.isEmpty();
  }

  /**
   * Measures one chunk around the viewer. Resolves `false` when
   * nothing was waiting near enough to take, which is also how a
   * caller learns the video is fully measured.
   */
  analyzeNextChunk(): Promise<boolean> {
    // The detector admits one run at a time, and a caller wanting a
    // head start can arrive while a background drain is mid-chunk —
    // switching sheets does exactly that. Queueing behind the chunk in
    // flight is also what makes a newly urgent stretch wait for the
    // current one and no longer.
    const run = this.running.catch(() => false).then(() => this.analyzeOneChunk());
    this.running = run;
    return run;
  }

  /**
   * Works through everything still waiting, one chunk at a time, and
   * closes the video and writes what was learned when there is nothing
   * left. Calling it while a drain is already running joins that one
   * rather than starting a second. Never rejects: a chunk that fails
   * ends the drain and is logged.
   */
  drain(): Promise<void> {
    this.draining ??= this.drainChunks();
    return this.draining;
  }

  /** Stops the drain after the chunk in flight, closes the video and writes what was learned. What is owed stays owed. */
  stop(): void {
    this.stopped = true;
    if (this.draining !== null) return;
    this.session.close();
    void this.persister.flush();
  }

  /** Whether anything ended up waiting once the already-measured part was taken off. */
  private async takeOnWhatIsMissing(ranges: TimeRangeSet): Promise<boolean> {
    this.forgetWorkOwedForAReplacedVideo();
    if (ranges.isEmpty()) return false;
    this.worthMasking = TimeRangeSet.of([...this.worthMasking.list(), ...ranges.list()]);
    const wanted = this.withRoomToQualify(ranges);
    const known = await this.resultReader.read(this.editorStore.snapshot().projectId);
    this.request(known === null ? wanted : known.missingFrom(wanted));
    return this.hasWorkLeft();
  }

  /**
   * The stretches reached past the captions by the minimum a window
   * has to last, because a scene qualifies on how long it stays steady
   * and not on how long a caption sits in it — without the margin a
   * caption shorter than the minimum could never sit inside a
   * qualifying window, however still the shot around it.
   *
   * Applied here, once, rather than to each chunk as it is measured:
   * per chunk the margins fall inside the neighbouring chunk and get
   * measured twice, and on a short fragment the margins are most of
   * the work.
   */
  private withRoomToQualify(ranges: TimeRangeSet): TimeRangeSet {
    const padded = ranges.paddedBy(PersonSegmentationThresholds.WINDOW_DURATION_MIN_SEC);
    const duration = this.editorStore.snapshot().video.duration;
    return Number.isFinite(duration) && duration > 0 ? padded.clampedTo(duration) : padded;
  }

  private forgetWorkOwedForAReplacedVideo(): void {
    const video = this.sourceResolver.identityOf(this.editorStore.snapshot().video);
    if (video === this.analyzingVideo) return;
    this.analyzingVideo = video;
    this.queue.clear();
    this.worthMasking = TimeRangeSet.EMPTY;
  }

  private async analyzeOneChunk(): Promise<boolean> {
    this.forgetWorkOwedForAReplacedVideo();
    const chunk = this.queue.nextChunkNear(this.viewerSeconds(), PersonSegmentationPacing.ANALYSIS_CHUNK_SEC);
    if (chunk.isEmpty()) return false;
    const video = await this.session.open();
    // The chunk reaches past the captions inside it, so masks are
    // asked for on the caption part alone: one outside a caption is
    // never read, and capturing is the expensive half.
    await this.analyzeRanges.execute(video, { toScan: chunk, toCapture: chunk.intersectedWith(this.worthMasking) });
    this.queue.settle(chunk);
    return true;
  }

  private async drainChunks(): Promise<void> {
    try {
      while (!this.stopped) {
        if (!await this.analyzeNextChunk()) return;
      }
    } catch (error) {
      console.error('[person-segmentation] background analysis stopped', error);
    } finally {
      this.session.close();
      await this.persister.flush();
      // Cleared before this promise settles, so a caller that joined
      // the drain and finds work still owed starts a fresh one rather
      // than joining this one again and waiting on nothing.
      this.draining = null;
    }
  }

  private viewerSeconds(): number {
    return this.editorStore.snapshot().video.currentTime;
  }
}
