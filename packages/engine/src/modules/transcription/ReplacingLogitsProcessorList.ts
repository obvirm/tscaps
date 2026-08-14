import { LogitsProcessorList, type LogitsProcessor } from '@huggingface/transformers';

/**
 * A logits-processor list whose `push` replaces any already-held
 * processor of the same class instead of appending a duplicate.
 *
 * The transformers.js ASR pipeline reuses one options object across
 * every window of a long transcription, and Whisper's `generate`
 * pushes a fresh set of internal processors into the provided list on
 * every call. On a plain list those pile up — window N would run N
 * copies of each internal processor. Replacement reproduces the
 * fresh-list semantics the library assumes: the newest instance wins.
 */
export class ReplacingLogitsProcessorList extends LogitsProcessorList {
  override push(item: LogitsProcessor): void {
    const existing = this.processors.findIndex(
      (held: LogitsProcessor) => held.constructor === item.constructor,
    );
    if (existing >= 0) this.processors.splice(existing, 1);
    super.push(item);
  }
}
