import type { SubtitleCue } from '@modules/subtitle-file/SubtitleCue';
import { SubtitleFileSerializer } from '@modules/subtitle-file/SubtitleFileSerializer';
import type { SubtitleGranularity } from '@modules/subtitle-file/SubtitleGranularity';
import { Timecode } from '@modules/subtitle-file/Timecode';

const NEW_LINE = '\n';

/**
 * Writes SubViewer (`.sbv`), one of the two shapes YouTube hands back
 * when captions are downloaded: a `H:MM:SS.mmm,H:MM:SS.mmm` range on
 * its own line, the rows beneath it, and a blank line between entries.
 * There is no counter and the hour is not padded.
 *
 * Like SubRip, the format cannot time anything below an entry, so word
 * granularity means one entry per word.
 */
export class SbvSubtitleFileSerializer extends SubtitleFileSerializer {
  readonly mediaType = 'text/plain';
  readonly fileExtension = 'sbv';

  protected write(cues: ReadonlyArray<SubtitleCue>, granularity: SubtitleGranularity): string {
    const entries = granularity === 'word' ? this.perWordCues(cues) : cues;
    return entries.map((cue) => this.writeCue(cue)).join(NEW_LINE);
  }

  private writeCue(cue: SubtitleCue): string {
    const range = `${this.timecode(cue.time.start)},${this.timecode(cue.time.end)}`;
    const body = cue.rows.map((row) => row.text()).join(NEW_LINE);
    return `${range}${NEW_LINE}${body}${NEW_LINE}`;
  }

  private timecode(position: number): string {
    const at = new Timecode(position);
    return `${at.hours}:${at.padded(at.minutes, 2)}:${at.padded(at.seconds, 2)}`
      + `.${at.padded(at.milliseconds, 3)}`;
  }
}
