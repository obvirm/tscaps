import type { SubtitleToken } from '@modules/subtitle-file/SubtitleToken';

/**
 * One visual line inside a subtitle entry. Always holds at least one
 * token, and its tokens are in reading order.
 */
export class SubtitleRow {
  constructor(readonly tokens: ReadonlyArray<SubtitleToken>) {}

  text(): string {
    return this.tokens.map((token) => token.text).join(' ');
  }
}
