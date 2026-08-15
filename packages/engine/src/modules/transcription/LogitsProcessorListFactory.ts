import type * as Transformers from '@huggingface/transformers';
import type { LogitsProcessor, LogitsProcessorList, Tensor } from '@huggingface/transformers';
import type { WhisperLoopAbortLogitsProcessor } from '@modules/transcription/WhisperLoopAbortLogitsProcessor';

/**
 * Builds the logits-processor list a generation is handed, out of the
 * inference library's base classes.
 *
 * The two subclasses below are defined here, against a module passed in,
 * rather than at the top of their own files against a static import.
 * `extends` runs when a module loads, so a subclass of a library class
 * makes that library a load-time dependency of every file that can reach
 * it — which is the whole package, through its entry point. Everything
 * that does not need the base class stays outside: the loop guard holds
 * its own detection and this only dresses it.
 *
 * Both classes are built once and reused. They close over nothing per
 * call, and rebuilding them would give the pipeline a different
 * `constructor` identity each time, which is exactly what the list's
 * replacement rule compares.
 */
export class LogitsProcessorListFactory {
  private listClass: (new () => LogitsProcessorList) | null = null;
  private guardClass: (new (guard: WhisperLoopAbortLogitsProcessor) => LogitsProcessor) | null = null;

  constructor(private readonly module: typeof Transformers) {}

  /** A list holding `guard`, ready to be passed as `logits_processor`. */
  build(guard: WhisperLoopAbortLogitsProcessor): LogitsProcessorList {
    const list = new (this.replacingList())();
    list.push(new (this.guardAdapter())(guard));
    return list;
  }

  /**
   * A processor list whose `push` replaces any already-held processor of
   * the same class instead of appending a duplicate.
   *
   * The ASR pipeline reuses one options object across every window of a
   * long transcription, and Whisper's `generate` pushes a fresh set of
   * internal processors into the provided list on every call. On a plain
   * list those pile up — window N would run N copies of each internal
   * processor. Replacement reproduces the fresh-list semantics the
   * library assumes: the newest instance wins.
   */
  private replacingList(): new () => LogitsProcessorList {
    if (this.listClass === null) {
      this.listClass = class extends this.module.LogitsProcessorList {
        override push(item: LogitsProcessor): void {
          const existing = this.processors.findIndex(
            (held: LogitsProcessor) => held.constructor === item.constructor,
          );
          if (existing >= 0) this.processors.splice(existing, 1);
          super.push(item);
        }
      };
    }
    return this.listClass;
  }

  /** Presents the loop guard as the processor shape the pipeline calls. */
  private guardAdapter(): new (guard: WhisperLoopAbortLogitsProcessor) => LogitsProcessor {
    if (this.guardClass === null) {
      this.guardClass = class extends this.module.LogitsProcessor {
        constructor(private readonly guard: WhisperLoopAbortLogitsProcessor) {
          super();
        }

        _call(inputIds: bigint[][], logits: Tensor): Tensor {
          return this.guard.apply(inputIds, logits);
        }
      };
    }
    return this.guardClass;
  }
}
