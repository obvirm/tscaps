import type { TimeFragment } from '@modules/document/TimeFragment';

/**
 * One spoken word inside a subtitle entry, with the window it occupies.
 *
 * Formats that can express timing below the entry level read the
 * windows; the rest read only the text.
 */
export class SubtitleToken {
  constructor(
    readonly text: string,
    readonly time: TimeFragment,
  ) {}
}
