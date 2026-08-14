import type { SubtitleCue } from '@modules/subtitle-file/SubtitleCue';
import { SubtitleFileSerializer } from '@modules/subtitle-file/SubtitleFileSerializer';
import type { SubtitleGranularity } from '@modules/subtitle-file/SubtitleGranularity';
import type { SubtitleRow } from '@modules/subtitle-file/SubtitleRow';
import { Timecode } from '@modules/subtitle-file/Timecode';

const NEW_LINE = '\n';
const HEADER = `WEBVTT${NEW_LINE}${NEW_LINE}`;

/**
 * Writes WebVTT (`.vtt`): a `WEBVTT` header, then a
 * `HH:MM:SS.mmm --> HH:MM:SS.mmm` range and its rows per entry.
 *
 * Word granularity costs nothing here. The format times words inside a
 * normal entry with an inline `<HH:MM:SS.mmm>` marker before each one,
 * so the entries stay readable and the file stays the same length —
 * the reason to prefer this format when the reader understands it.
 */
export class VttSubtitleFileSerializer extends SubtitleFileSerializer {
  readonly mediaType = 'text/vtt';
  readonly fileExtension = 'vtt';

  protected write(cues: ReadonlyArray<SubtitleCue>, granularity: SubtitleGranularity): string {
    const body = cues.map((cue) => this.writeCue(cue, granularity)).join(NEW_LINE);
    return `${HEADER}${body}`;
  }

  private writeCue(cue: SubtitleCue, granularity: SubtitleGranularity): string {
    const range = `${this.timecode(cue.time.start)} --> ${this.timecode(cue.time.end)}`;
    const body = cue.rows.map((row) => this.writeRow(row, granularity)).join(NEW_LINE);
    return `${range}${NEW_LINE}${body}${NEW_LINE}`;
  }

  private writeRow(row: SubtitleRow, granularity: SubtitleGranularity): string {
    if (granularity === 'segment') return row.text();
    return row.tokens
      .map((token, index) => (index === 0 ? token.text : `<${this.timecode(token.time.start)}>${token.text}`))
      .join(' ');
  }

  private timecode(position: number): string {
    const at = new Timecode(position);
    return `${at.padded(at.hours, 2)}:${at.padded(at.minutes, 2)}:${at.padded(at.seconds, 2)}`
      + `.${at.padded(at.milliseconds, 3)}`;
  }
}
