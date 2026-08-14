import type { SubtitleCue } from '@modules/subtitle-file/SubtitleCue';
import { SubtitleFileSerializer } from '@modules/subtitle-file/SubtitleFileSerializer';
import type { SubtitleGranularity } from '@modules/subtitle-file/SubtitleGranularity';
import { Timecode } from '@modules/subtitle-file/Timecode';

/** SubRip separates rows and blocks with CRLF, and readers are strict about it. */
const NEW_LINE = '\r\n';

/**
 * Writes SubRip (`.srt`): a one-based counter, a
 * `HH:MM:SS,mmm --> HH:MM:SS,mmm` range, and the entry's rows, with a
 * blank line between blocks.
 *
 * The format has no way to time anything below an entry, so word
 * granularity is paid for in entries: one per word, which multiplies
 * the file's length several times over. Every player understands the
 * result, which is the reason to accept the cost.
 */
export class SrtSubtitleFileSerializer extends SubtitleFileSerializer {
  readonly mediaType = 'application/x-subrip';
  readonly fileExtension = 'srt';

  protected write(cues: ReadonlyArray<SubtitleCue>, granularity: SubtitleGranularity): string {
    const entries = granularity === 'word' ? this.perWordCues(cues) : cues;
    return entries.map((cue, index) => this.writeCue(cue, index + 1)).join(NEW_LINE);
  }

  private writeCue(cue: SubtitleCue, position: number): string {
    const range = `${this.timecode(cue.time.start)} --> ${this.timecode(cue.time.end)}`;
    const body = cue.rows.map((row) => row.text()).join(NEW_LINE);
    return `${position}${NEW_LINE}${range}${NEW_LINE}${body}${NEW_LINE}`;
  }

  private timecode(position: number): string {
    const at = new Timecode(position);
    return `${at.padded(at.hours, 2)}:${at.padded(at.minutes, 2)}:${at.padded(at.seconds, 2)}`
      + `,${at.padded(at.milliseconds, 3)}`;
  }
}
