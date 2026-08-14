import type { Document } from '@modules/document/Document';

/**
 * What reading a caption file produced: the cues that could be read,
 * and the blocks that could not.
 *
 * The two travel together because a caption file is rarely all right
 * or all wrong. A reader that returned only the document would leave
 * its caller unable to tell a file that was fully understood from one
 * that was mostly understood.
 */
export interface CueParseResult {
  readonly document: Document;

  /** Verbatim text of every block that carried no timecode. */
  readonly skippedBlocks: readonly string[];
}
