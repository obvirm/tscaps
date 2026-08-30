import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { TimelineChannelMoves } from '@presentation/timeline/services/TimelineChannelMoves';
import { TimelineChannelResolver } from '@presentation/timeline/services/TimelineChannelResolver';
import { TimelineSceneExtentResolver } from '@presentation/timeline/services/TimelineSceneExtentResolver';

/**
 * What the reader is told about a sheet changing channel.
 *
 * The promise is one-sided: a move is reported when text has left the
 * channel on screen, and reported at no other time. The second half is
 * the one that breaks — channels are re-derived from the whole document
 * on every edit, so anything about them that shifts for a reason other
 * than an overlap appearing reads as text having moved.
 *
 * The channels are resolved from real documents rather than written out
 * by hand, because that is where the shift comes from.
 */

const resolver = new TimelineChannelResolver(new TimelineSceneExtentResolver());
const moves = new TimelineChannelMoves();

function scene(startSec: number, endSec: number): Segment {
  const word = new Word({ text: 'word', time: new TimeFragment(startSec, endSec) });
  return new Segment({ lines: [new Line({ words: [word] })] });
}

function documentOf(sections: ReadonlyArray<{ kind: string; scenes: Segment[] }>): Document {
  return new Document({
    sections: sections.map((s) => new Section({ kind: s.kind, segments: s.scenes })),
  });
}

function sheetNamed(id: string, name: string): Sheet {
  return { id, name } as unknown as Sheet;
}

const SHEETS = [sheetNamed('main', 'Main'), sheetNamed('hook', 'Hook')];

function channelsOf(document: Document) {
  return resolver.resolve(document, SHEETS);
}

describe('what the reader is told when channels are re-derived', () => {
  it('says nothing when the main sheet gives up its last scene', () => {
    const before = channelsOf(documentOf([
      { kind: 'main', scenes: [scene(0, 1)] },
      { kind: 'hook', scenes: [scene(2, 3)] },
    ]));
    const after = channelsOf(documentOf([
      { kind: 'hook', scenes: [scene(0, 1), scene(2, 3)] },
    ]));

    expect(before).toHaveLength(1);
    expect(after).toHaveLength(1);
    expect(moves.since(before, after, before[0]!.id)).toEqual([]);
  });

  it('says nothing when the main sheet takes a scene back', () => {
    const before = channelsOf(documentOf([
      { kind: 'hook', scenes: [scene(0, 1), scene(2, 3)] },
    ]));
    const after = channelsOf(documentOf([
      { kind: 'main', scenes: [scene(0, 1)] },
      { kind: 'hook', scenes: [scene(2, 3)] },
    ]));

    expect(after).toHaveLength(1);
    expect(moves.since(before, after, before[0]!.id)).toEqual([]);
  });

  it('says nothing when a sheet is left holding no scenes at all', () => {
    const before = channelsOf(documentOf([
      { kind: 'main', scenes: [scene(0, 1)] },
      { kind: 'hook', scenes: [scene(2, 3)] },
    ]));
    const after = channelsOf(documentOf([
      { kind: 'main', scenes: [scene(0, 1), scene(2, 3)] },
    ]));

    expect(moves.since(before, after, before[0]!.id)).toEqual([]);
  });

  it('says nothing when the reader changes channel themselves', () => {
    const channels = channelsOf(documentOf([
      { kind: 'main', scenes: [scene(0, 5)] },
      { kind: 'hook', scenes: [scene(1, 2)] },
    ]));
    const pooled = channels[0]!;

    expect(channels).toHaveLength(2);
    expect(moves.since(channels, channels, pooled.id)).toEqual([]);
  });

  it('reports a sheet that has come to overlap and left the channel on screen', () => {
    const before = channelsOf(documentOf([
      { kind: 'main', scenes: [scene(0, 1)] },
      { kind: 'hook', scenes: [scene(2, 3)] },
    ]));
    const after = channelsOf(documentOf([
      { kind: 'main', scenes: [scene(0, 3)] },
      { kind: 'hook', scenes: [scene(2, 3)] },
    ]));

    expect(moves.since(before, after, before[0]!.id)).toEqual([
      { sheetId: 'hook', toChannelName: 'Hook', split: true },
    ]);
  });
});
