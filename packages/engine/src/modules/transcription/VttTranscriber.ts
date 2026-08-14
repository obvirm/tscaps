import type { Document } from '@modules/document/Document';
import { CueDocumentBuilder } from '@modules/transcription/CueDocumentBuilder';
import { CueTextTokenizer } from '@modules/transcription/CueTextTokenizer';
import { CueTimecodeReader } from '@modules/transcription/CueTimecodeReader';
import { TimestampedCueWordReader } from '@modules/transcription/TimestampedCueWordReader';
import { WordTimingEstimator } from '@modules/transcription/WordTimingEstimator';
import type {
  Transcriber,
  TranscriberOptions,
  TranscriberProgressEvent,
} from '@modules/transcription/Transcriber';

const BOM_RE = /^\uFEFF/;

/**
 * Builds a Document by parsing a WebVTT (`.vtt`) caption file. Skips
 * the mandatory `WEBVTT` header block and any `NOTE`, `STYLE`, or
 * `REGION` blocks, then reads the cues below them.
 *
 * WebVTT can mark inside a cue when each word is spoken, and those
 * marks are honoured: a file carrying them yields the word timings it
 * recorded rather than a guess. Where a cue carries no marks, its words
 * are shared out across it the way a format without marks requires.
 *
 * The audio Blob passed to `transcribe` is ignored. Useful when
 * caption text and timing are already known — burning a hand-authored
 * VTT into a video, replaying captions from a subtitle-authoring
 * tool, etc.
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
export class VttTranscriber implements Transcriber {
  onProgress?: (event: TranscriberProgressEvent) => void;

  /**
   * Fired once per block left out of the document, before
   * `transcribe` resolves, carrying the block verbatim.
   */
  onSkippedCueBlock?: (block: string) => void;

  private readonly timecodeReader = new CueTimecodeReader();
  private readonly documentBuilder = new CueDocumentBuilder(this.timecodeReader);
  private readonly wordReader = new TimestampedCueWordReader(
    new CueTextTokenizer(),
    this.timecodeReader,
    new WordTimingEstimator(),
  );

  constructor(private readonly source: string) {}

  async transcribe(_audio: Blob, _options?: TranscriberOptions): Promise<Document> {
    this.onProgress?.({ stage: 'inferring', progress: 1 });
    const result = this.documentBuilder.build(this.extractCueBlocks(this.source), this.wordReader);
    for (const block of result.skippedBlocks) this.onSkippedCueBlock?.(block);
    return result.document;
  }

  private extractCueBlocks(source: string): string {
    const normalized = source.replace(BOM_RE, '').replace(/\r\n?/g, '\n');
    return this.stripWebVttHeader(normalized)
      .split(/\n{2,}/)
      .filter((block) => this.isCueBlock(block))
      .join('\n\n');
  }

  private stripWebVttHeader(source: string): string {
    if (!/^WEBVTT(?:\s|$)/.test(source)) return source;
    const firstBlockEnd = source.indexOf('\n\n');
    if (firstBlockEnd === -1) return '';
    return source.slice(firstBlockEnd + 2);
  }

  private isCueBlock(block: string): boolean {
    const firstLine = block.trim().split('\n')[0]?.trim() ?? '';
    if (firstLine.length === 0) return false;
    if (firstLine === 'STYLE' || firstLine === 'REGION') return false;
    if (firstLine === 'NOTE' || firstLine.startsWith('NOTE ') || firstLine.startsWith('NOTE\t')) return false;
    return true;
  }
}
