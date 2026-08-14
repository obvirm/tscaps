import type { Document } from '@modules/document/Document';
import { CueDocumentBuilder } from '@modules/transcription/CueDocumentBuilder';
import { CueTextTokenizer } from '@modules/transcription/CueTextTokenizer';
import { CueTimecodeReader } from '@modules/transcription/CueTimecodeReader';
import { EstimatedCueWordReader } from '@modules/transcription/EstimatedCueWordReader';
import { WordTimingEstimator } from '@modules/transcription/WordTimingEstimator';
import type {
  Transcriber,
  TranscriberOptions,
  TranscriberProgressEvent,
} from '@modules/transcription/Transcriber';

/**
 * Builds a Document by parsing a SubRip (SRT) caption file. Each cue
 * becomes one `Segment` carrying the cue's full time range; the cue's
 * text (multi-line entries joined with a space, formatting tags
 * stripped) becomes one `Line`.
 *
 * SubRip times nothing below a cue, so word timings are shared out
 * across the cue in proportion to how long each word is to write. Each
 * word lights up in sequence rather than all at once, but where one
 * begins is a guess, not something the file said.
 *
 * The audio Blob passed to `transcribe` is ignored. Useful when the
 * caption text and timing are already known — burning a hand-authored
 * SRT into a video, replaying captions from a previous run, etc.
 *
 * A block that carries no timecode is skipped and announced through
 * `onSkippedCueBlock`, so a single broken cue costs its own text and
 * nothing else. Throws only when the file has blocks and none of them
 * could be read, or when a timecode itself is malformed.
 *
 * Builds its own collaborators rather than receiving them. The
 * constructor is the surface a consumer of the engine reaches for, and
 * it asks for a source and nothing else, so this class is where the
 * parsing side is assembled rather than a participant in someone
 * else's assembly.
 */
export class SrtTranscriber implements Transcriber {
  onProgress?: (event: TranscriberProgressEvent) => void;

  /**
   * Fired once per block left out of the document, before
   * `transcribe` resolves, carrying the block verbatim.
   */
  onSkippedCueBlock?: (block: string) => void;

  private readonly documentBuilder = new CueDocumentBuilder(new CueTimecodeReader());
  private readonly wordReader = new EstimatedCueWordReader(
    new CueTextTokenizer(),
    new WordTimingEstimator(),
  );

  constructor(private readonly source: string) {}

  async transcribe(_audio: Blob, _options?: TranscriberOptions): Promise<Document> {
    this.onProgress?.({ stage: 'inferring', progress: 1 });
    const result = this.documentBuilder.build(this.source, this.wordReader);
    for (const block of result.skippedBlocks) this.onSkippedCueBlock?.(block);
    return result.document;
  }
}
