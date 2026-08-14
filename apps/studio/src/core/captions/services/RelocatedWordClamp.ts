import { DocumentEditor, type Document } from '@tscaps/engine';
import type { SegmentTimeBounds } from '@core/captions/services/SegmentTimeBounds';
import type { WordTimeBounds } from '@core/captions/services/WordTimeBounds';

const docEditor = new DocumentEditor();

/**
 * Pulls a word that changed segment back inside the window its new
 * segment is allowed to occupy.
 *
 * Two words of one segment may narrate at once: the segment is a
 * sequence, and that sequence is what says which of them comes first.
 * Move one of the pair into a neighbouring segment and the sequence is
 * gone — the two segments now claim the same instant, and a document
 * reports **every** segment covering an instant as active, so both
 * captions would be drawn at once, in one sheet's single position, in
 * the video itself.
 *
 * The word that moved is the one that gives way, and it gives way
 * exactly as far as the same-sheet neighbour's hard time. Words that
 * stayed put are never touched, so an edit that crosses nothing leaves
 * the document as it found it.
 */
export class RelocatedWordClamp {

  constructor(
    private readonly wordBounds: WordTimeBounds,
    private readonly segmentBounds: SegmentTimeBounds,
  ) {}

  clamped(before: Document, after: Document, videoDurationSec: number): Document {
    let document = after;
    for (const wordId of this.relocatedWordIds(before, after)) {
      document = this.pullInside(document, wordId, videoDurationSec);
    }
    return document;
  }

  // A word the edit brought into being was in no segment before, so it
  // counts here too: it is as unbound by the old sequence as one that
  // moved, and leaving it out would let an edit place a word wherever it
  // liked. Words the edit removed never come up — they are not in
  // `after` to be walked.
  private relocatedWordIds(before: Document, after: Document): string[] {
    const wasIn = this.segmentIdByWordId(before);
    const ids: string[] = [];
    for (const [wordId, segmentId] of this.segmentIdByWordId(after)) {
      if (wasIn.get(wordId) !== segmentId) ids.push(wordId);
    }
    return ids;
  }

  private segmentIdByWordId(document: Document): Map<string, string> {
    const segmentIds = new Map<string, string>();
    for (const segment of document.getSegments()) {
      for (const word of segment.getWords()) segmentIds.set(word.id, segment.id);
    }
    return segmentIds;
  }

  private pullInside(document: Document, wordId: string, videoDurationSec: number): Document {
    const position = docEditor.findWordById(document, wordId);
    if (!position) return document;
    const segment = document.getSegments()[position.segIdx];
    const word = segment?.getWords().find((candidate) => candidate.id === wordId);
    if (!segment || !word) return document;

    const limits = this.segmentBounds.limitsFor(document, segment.id, videoDurationSec);
    const time = this.wordBounds.clamp(
      { startSec: word.time.start, endSec: word.time.end },
      limits,
    );
    if (time.startSec === word.time.start && time.endSec === word.time.end) return document;
    return docEditor.updateWordTime(
      document,
      position.segIdx,
      position.lineIdx,
      position.wordIdx,
      time.startSec,
      time.endSec,
    );
  }
}
