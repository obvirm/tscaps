/** One word-timestamped chunk as transformers.js reports it. */
export interface WhisperChunk {
  text: string;
  timestamp: [number | null, number | null];
}

/**
 * Reconciles the chunk streams from consecutive pipeline windows into
 * one non-duplicated timeline.
 *
 * transformers.js runs Whisper's chunk-and-stitch long-form strategy:
 * consecutive windows overlap by `2 * strideLengthSeconds`, and each
 * window transcribes its full range independently. The library is
 * supposed to discard the overlap zones at stitch time but its word-
 * timestamps path leaks them through — both windows' takes on the
 * same audio land in the final chunks. Under a degenerate loop or a
 * token-ceiling cut, a window can also flood its overlap zone with
 * garbage.
 *
 * This class re-splits the merged chunk stream back into per-window
 * groups (detected via timestamp drops in generation order) and crops
 * each to a single half of every overlap. The split point between two
 * consecutive windows is the later of the overlap midpoint and the
 * next window's own first chunk — so if the next window declared
 * silence over part of its overlap, the previous window's take on
 * that same audio is kept instead of dropped.
 */
export class WhisperChunkStitcher {
  constructor(
    private readonly chunkLengthSeconds: number,
    private readonly strideLengthSeconds: number,
  ) {}

  stitch(chunks: WhisperChunk[], audioDurationSeconds: number): WhisperChunk[] {
    const groups = this.splitByGenerationWindow(chunks);
    if (groups.length <= 1) return chunks;
    const boundaries = this.trustBoundariesBetween(groups);
    return groups.flatMap((group, index) => this.cropGroup(
      group,
      this.leftBoundaryOf(index, boundaries),
      this.rightBoundaryOf(index, boundaries, groups.length, audioDurationSeconds),
    ));
  }

  /**
   * Splits the merged chunk stream into per-window groups. Windows emit
   * in generation order and each window's own timestamps are monotonic,
   * so a chunk whose anchor is earlier than the previous chunk's marks
   * the start of the next window.
   */
  private splitByGenerationWindow(chunks: WhisperChunk[]): WhisperChunk[][] {
    const groups: WhisperChunk[][] = [];
    let current: WhisperChunk[] = [];
    let previousAnchor: number | null = null;
    for (const chunk of chunks) {
      const anchor = this.anchorOf(chunk);
      if (anchor !== null && previousAnchor !== null && anchor < previousAnchor) {
        groups.push(current);
        current = [];
      }
      current.push(chunk);
      if (anchor !== null) previousAnchor = anchor;
    }
    if (current.length > 0) groups.push(current);
    return groups;
  }

  /**
   * The split points between consecutive window groups, in absolute
   * seconds. `boundaries[i]` is the second at which trust hands over
   * from window `i` to window `i + 1`.
   */
  private trustBoundariesBetween(groups: WhisperChunk[][]): number[] {
    const advance = this.chunkLengthSeconds - 2 * this.strideLengthSeconds;
    const boundaries: number[] = [];
    for (let index = 0; index < groups.length - 1; index++) {
      const overlapMidpoint = index * advance + this.chunkLengthSeconds - this.strideLengthSeconds;
      const nextGroupFirstAnchor = this.firstAnchorOf(groups[index + 1]!);
      boundaries.push(
        nextGroupFirstAnchor === null
          ? overlapMidpoint
          : Math.max(overlapMidpoint, nextGroupFirstAnchor),
      );
    }
    return boundaries;
  }

  private leftBoundaryOf(groupIndex: number, boundaries: number[]): number {
    return groupIndex === 0 ? 0 : boundaries[groupIndex - 1]!;
  }

  private rightBoundaryOf(
    groupIndex: number,
    boundaries: number[],
    groupCount: number,
    audioDurationSeconds: number,
  ): number {
    return groupIndex === groupCount - 1 ? audioDurationSeconds : boundaries[groupIndex]!;
  }

  private cropGroup(group: WhisperChunk[], leftSeconds: number, rightSeconds: number): WhisperChunk[] {
    return group.filter((chunk) => {
      const anchor = this.anchorOf(chunk);
      return anchor !== null && anchor >= leftSeconds && anchor < rightSeconds;
    });
  }

  private anchorOf(chunk: WhisperChunk): number | null {
    return chunk.timestamp[0] ?? chunk.timestamp[1];
  }

  private firstAnchorOf(group: WhisperChunk[]): number | null {
    for (const chunk of group) {
      const anchor = this.anchorOf(chunk);
      if (anchor !== null) return anchor;
    }
    return null;
  }
}
