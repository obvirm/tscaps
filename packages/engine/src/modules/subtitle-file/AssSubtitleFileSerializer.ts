import type { SubtitleCue } from '@modules/subtitle-file/SubtitleCue';
import { SubtitleFileSerializer } from '@modules/subtitle-file/SubtitleFileSerializer';
import type { SubtitleGranularity } from '@modules/subtitle-file/SubtitleGranularity';
import { Timecode } from '@modules/subtitle-file/Timecode';

const NEW_LINE = '\r\n';
const ROW_BREAK = '\\N';

/**
 * The reference frame the style's sizes and margins are read against.
 * A renderer scales the whole script from it to whatever the video
 * actually measures, so the numbers stay sensible on any footage.
 */
const REFERENCE_WIDTH = 1920;
const REFERENCE_HEIGHT = 1080;

/**
 * A deliberately plain style. The design a project carries cannot
 * survive the trip — the format addresses fonts by name and expects
 * them installed on the machine that plays the file, and it has no way
 * to express per-word animation, narration highlighting or any of the
 * effects a template is built from. A partial likeness would read as a
 * broken export rather than as the limit of the format, so the file
 * states plainly that it carries text and timing.
 *
 * Fields, in the order the format declares them: name, font, size, the
 * four colours (ABGR, leading pair is alpha), the four toggles, scale,
 * spacing, angle, border style, outline, shadow, alignment, the three
 * margins, encoding.
 */
const DEFAULT_STYLE =
  'Style: Default,Arial,48,&H00FFFFFF,&H00A0A0A0,&H00000000,&H00000000,'
  + '0,0,0,0,100,100,0,0,1,3,0,2,60,60,60,1';

const HEADER = [
  '[Script Info]',
  'ScriptType: v4.00+',
  'WrapStyle: 0',
  'ScaledBorderAndShadow: yes',
  `PlayResX: ${REFERENCE_WIDTH}`,
  `PlayResY: ${REFERENCE_HEIGHT}`,
  '',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour,'
  + ' Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline,'
  + ' Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  DEFAULT_STYLE,
  '',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
].join(NEW_LINE);

/**
 * Writes Advanced SubStation Alpha (`.ass`), the format karaoke, anime
 * and fansub tooling is built around.
 *
 * Word granularity is what this format exists for: a `\k` tag before
 * each word states how long it is held, and a renderer walks the line
 * word by word without the entry ever being split. The file stays the
 * same length as at entry granularity, which no plain-cue format can
 * manage.
 *
 * Styling does not travel. See the note on the default style for why
 * carrying part of it would be worse than carrying none.
 */
export class AssSubtitleFileSerializer extends SubtitleFileSerializer {
  readonly mediaType = 'text/x-ssa';
  readonly fileExtension = 'ass';

  protected write(cues: ReadonlyArray<SubtitleCue>, granularity: SubtitleGranularity): string {
    const events = cues.map((cue) => this.writeCue(cue, granularity)).join(NEW_LINE);
    const separator = events.length > 0 ? NEW_LINE : '';
    return `${HEADER}${separator}${events}${NEW_LINE}`;
  }

  private writeCue(cue: SubtitleCue, granularity: SubtitleGranularity): string {
    const start = this.timecode(cue.time.start);
    const end = this.timecode(cue.time.end);
    const body = granularity === 'word' ? this.writeSungBody(cue) : this.writePlainBody(cue);
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${body}`;
  }

  private writePlainBody(cue: SubtitleCue): string {
    return cue.rows.map((row) => this.escape(row.text())).join(ROW_BREAK);
  }

  /**
   * A `\k` states how long the syllable before the next one is held, so
   * the tags run back to back and nothing addresses the timeline
   * directly. Silence between two words therefore has to be spent
   * somewhere or every word after it starts early, and the drift adds
   * up across the line.
   *
   * Each word is held until the next one is spoken, which spends the
   * silence on the word already sung and leaves the highlight where the
   * ear left it. Silence before the first word has no word to fall to,
   * so it becomes an empty syllable. The syllables then tile the entry
   * exactly.
   */
  private writeSungBody(cue: SubtitleCue): string {
    const boundaries = this.syllableBoundaries(cue);
    const rows: string[] = [];
    let spoken = 0;
    for (const row of cue.rows) {
      const syllables = row.tokens.map((token) => {
        const held = boundaries[spoken + 1]! - boundaries[spoken]!;
        const silence = spoken === 0 ? this.leadIn(boundaries[0]!) : '';
        spoken += 1;
        return `${silence}{\\k${held}}${this.escape(token.text)}`;
      });
      rows.push(syllables.join(' '));
    }
    return rows.join(ROW_BREAK);
  }

  /**
   * Where each word starts and where the entry ends, in hundredths from
   * the entry's own start. Rounding positions rather than durations
   * keeps the syllables from drifting out of the entry they belong to.
   */
  private syllableBoundaries(cue: SubtitleCue): ReadonlyArray<number> {
    const origin = cue.time.start;
    const starts = cue.tokens().map((token) => this.centiseconds(token.time.start - origin));
    return [...starts, this.centiseconds(cue.time.end - origin)];
  }

  private leadIn(firstWordAt: number): string {
    return firstWordAt > 0 ? `{\\k${firstWordAt}}` : '';
  }

  /** Braces open and close override blocks, so text has to disclaim them. */
  private escape(text: string): string {
    return text.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
  }

  private centiseconds(seconds: number): number {
    return Math.max(0, Math.round(seconds * 100));
  }

  /**
   * Rounding to hundredths before splitting the position keeps a value
   * a hair under a whole second from printing as a hundredth too many.
   */
  private timecode(position: number): string {
    const at = new Timecode(Math.round(position * 100) / 100);
    return `${at.hours}:${at.padded(at.minutes, 2)}:${at.padded(at.seconds, 2)}`
      + `.${at.padded(at.centiseconds(), 2)}`;
  }
}
