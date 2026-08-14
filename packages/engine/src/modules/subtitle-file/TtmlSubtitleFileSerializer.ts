import type { SubtitleCue } from '@modules/subtitle-file/SubtitleCue';
import { SubtitleFileSerializer } from '@modules/subtitle-file/SubtitleFileSerializer';
import type { SubtitleGranularity } from '@modules/subtitle-file/SubtitleGranularity';
import type { SubtitleRow } from '@modules/subtitle-file/SubtitleRow';
import { Timecode } from '@modules/subtitle-file/Timecode';

const NEW_LINE = '\n';
const PROLOGUE = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<tt xmlns="http://www.w3.org/ns/ttml">',
  '  <body>',
  '    <div>',
].join(NEW_LINE);
const EPILOGUE = ['    </div>', '  </body>', '</tt>', ''].join(NEW_LINE);

/**
 * Writes TTML (`.ttml`, also served as DFXP), the timed-text XML that
 * broadcast and streaming workflows exchange. Each entry is a `<p>`
 * carrying `begin` and `end`, and a row break inside one becomes
 * `<br/>`.
 *
 * The format times words inside an entry with nested `<span>` elements,
 * so word granularity costs no extra entries.
 */
export class TtmlSubtitleFileSerializer extends SubtitleFileSerializer {
  readonly mediaType = 'application/ttml+xml';
  readonly fileExtension = 'ttml';

  protected write(cues: ReadonlyArray<SubtitleCue>, granularity: SubtitleGranularity): string {
    const body = cues.map((cue) => this.writeCue(cue, granularity)).join(NEW_LINE);
    const separator = body.length > 0 ? NEW_LINE : '';
    return `${PROLOGUE}${separator}${body}${NEW_LINE}${EPILOGUE}`;
  }

  private writeCue(cue: SubtitleCue, granularity: SubtitleGranularity): string {
    const begin = this.timecode(cue.time.start);
    const end = this.timecode(cue.time.end);
    const body = cue.rows.map((row) => this.writeRow(row, granularity)).join('<br/>');
    return `      <p begin="${begin}" end="${end}">${body}</p>`;
  }

  private writeRow(row: SubtitleRow, granularity: SubtitleGranularity): string {
    if (granularity === 'segment') return this.escape(row.text());
    return row.tokens
      .map((token) => {
        const begin = this.timecode(token.time.start);
        const end = this.timecode(token.time.end);
        return `<span begin="${begin}" end="${end}">${this.escape(token.text)}</span>`;
      })
      .join(' ');
  }

  private escape(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private timecode(position: number): string {
    const at = new Timecode(position);
    return `${at.padded(at.hours, 2)}:${at.padded(at.minutes, 2)}:${at.padded(at.seconds, 2)}`
      + `.${at.padded(at.milliseconds, 3)}`;
  }
}
