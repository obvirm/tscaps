import bidiFactory, { type Bidi } from 'bidi-js';
import type { BidiAnalysis, BidiAnalyzer } from '@modules/bidi/BidiAnalyzer';
import type { TextDirection } from '@modules/bidi/TextDirection';

/**
 * Bidi resolution backed by a standalone implementation of UAX #9.
 *
 * Resolves from the characters alone and never touches the DOM, so the
 * same text yields the same layout in a browser, a worker, or a build
 * step.
 */
export class BidiJsAnalyzer implements BidiAnalyzer {
  private readonly bidi: Bidi = bidiFactory();

  analyze(text: string, baseDirection: TextDirection): BidiAnalysis {
    const embedding = this.bidi.getEmbeddingLevels(text, baseDirection);
    return {
      levels: Array.from(embedding.levels),
      visualOrder: this.bidi.getReorderedIndices(text, embedding),
    };
  }
}
