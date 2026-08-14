import type { TimelineChannel } from '@presentation/timeline/services/TimelineChannelResolver';

/** A sheet that has changed which channel it is read in. */
export interface TimelineChannelMove {
  readonly sheetId: string;
  readonly toChannelName: string;
  /** Whether it now has a channel to itself, having come to overlap another sheet. */
  readonly split: boolean;
}

/**
 * What moved out of the channel being read.
 *
 * Channels are worked out from the document, so an edit can change which
 * one a sheet belongs to — and the reader sees a whole stretch of text
 * leave the timeline with nothing to say why. This is what lets them be
 * told.
 *
 * Only moves out of the channel on screen count. A sheet reshuffling
 * between two channels the reader is not looking at takes nothing away
 * from them, and saying so would be noise.
 */
export class TimelineChannelMoves {

  since(
    before: ReadonlyArray<TimelineChannel>,
    after: ReadonlyArray<TimelineChannel>,
    readChannelId: string,
  ): TimelineChannelMove[] {
    const wasRead = before.find((channel) => channel.id === readChannelId);
    if (!wasRead) return [];
    const moves: TimelineChannelMove[] = [];
    for (const sheetId of wasRead.sheetIds) {
      const now = after.find((channel) => channel.sheetIds.includes(sheetId));
      if (!now || now.id === readChannelId) continue;
      moves.push({ sheetId, toChannelName: now.name, split: now.sheetIds.length === 1 });
    }
    return moves;
  }
}
