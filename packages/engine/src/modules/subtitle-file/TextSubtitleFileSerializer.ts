import type { SubtitleCue } from '@modules/subtitle-file/SubtitleCue';
import { SubtitleFileSerializer } from '@modules/subtitle-file/SubtitleFileSerializer';
import type { SubtitleGranularity } from '@modules/subtitle-file/SubtitleGranularity';

const NEW_LINE = '\n';

/**
 * Writes the plain transcript (`.txt`): one line per entry, no timing
 * at all. For the reader whose errand is the words themselves — notes,
 * an article, a translation pass — rather than anything played back.
 *
 * Rows are joined with a space rather than kept apart, because where a
 * caption wrapped on screen says nothing about the text. Granularity is
 * ignored: a file with no timing has no timing to make finer.
 */
export class TextSubtitleFileSerializer extends SubtitleFileSerializer {
  readonly mediaType = 'text/plain';
  readonly fileExtension = 'txt';

  protected write(cues: ReadonlyArray<SubtitleCue>, _granularity: SubtitleGranularity): string {
    if (cues.length === 0) return '';
    return `${cues.map((cue) => this.writeCue(cue)).join(NEW_LINE)}${NEW_LINE}`;
  }

  private writeCue(cue: SubtitleCue): string {
    return cue.rows.map((row) => row.text()).join(' ');
  }
}
