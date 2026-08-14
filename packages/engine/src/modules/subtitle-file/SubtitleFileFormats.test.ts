import { describe, expect, it } from 'vitest';
import { Document } from '@modules/document/Document';
import { Line } from '@modules/document/Line';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { TimeFragment } from '@modules/document/TimeFragment';
import { Word } from '@modules/document/Word';
import { AssSubtitleFileSerializer } from '@modules/subtitle-file/AssSubtitleFileSerializer';
import { SbvSubtitleFileSerializer } from '@modules/subtitle-file/SbvSubtitleFileSerializer';
import { SrtSubtitleFileSerializer } from '@modules/subtitle-file/SrtSubtitleFileSerializer';
import { TextSubtitleFileSerializer } from '@modules/subtitle-file/TextSubtitleFileSerializer';
import { TtmlSubtitleFileSerializer } from '@modules/subtitle-file/TtmlSubtitleFileSerializer';
import { VttSubtitleFileSerializer } from '@modules/subtitle-file/VttSubtitleFileSerializer';

/**
 * What a reader actually receives, format by format: a document goes
 * in, the file's text comes out.
 */

function word(text: string, start: number, end: number): Word {
  return new Word({ text, time: new TimeFragment(start, end) });
}

function segment(...words: Word[]): Segment {
  return new Segment({ lines: [new Line({ words })] });
}

/** "Hello there" over the first two seconds, then "again" at five. */
const document = new Document({
  sections: [new Section({
    segments: [segment(word('Hello', 0, 1), word('there', 1, 2)), segment(word('again', 5, 7))],
    kind: '',
  })],
});

describe('SubRip', () => {
  const serializer = new SrtSubtitleFileSerializer();

  it('numbers entries and separates them with a blank line', () => {
    expect(serializer.serialize({ document, granularity: 'segment' })).toBe(
      '1\r\n00:00:00,000 --> 00:00:02,000\r\nHello there\r\n'
      + '\r\n'
      + '2\r\n00:00:05,000 --> 00:00:07,000\r\nagain\r\n',
    );
  });

  it('pays for word timing with one entry per word', () => {
    expect(serializer.serialize({ document, granularity: 'word' })).toBe(
      '1\r\n00:00:00,000 --> 00:00:01,000\r\nHello\r\n'
      + '\r\n'
      + '2\r\n00:00:01,000 --> 00:00:02,000\r\nthere\r\n'
      + '\r\n'
      + '3\r\n00:00:05,000 --> 00:00:07,000\r\nagain\r\n',
    );
  });

  it('writes on the timeline the excluded windows leave behind', () => {
    const output = serializer.serialize({
      document,
      granularity: 'segment',
      skipRanges: [{ startSec: 2, endSec: 4 }],
    });
    expect(output).toContain('00:00:03,000 --> 00:00:05,000\r\nagain');
  });
});

describe('WebVTT', () => {
  const serializer = new VttSubtitleFileSerializer();

  it('opens with the format marker and drops the counter', () => {
    expect(serializer.serialize({ document, granularity: 'segment' })).toBe(
      'WEBVTT\n\n'
      + '00:00:00.000 --> 00:00:02.000\nHello there\n'
      + '\n'
      + '00:00:05.000 --> 00:00:07.000\nagain\n',
    );
  });

  // The entry count is unchanged from segment granularity: this is the
  // whole reason to reach for the format.
  it('times words inside the entry instead of multiplying entries', () => {
    expect(serializer.serialize({ document, granularity: 'word' })).toBe(
      'WEBVTT\n\n'
      + '00:00:00.000 --> 00:00:02.000\nHello <00:00:01.000>there\n'
      + '\n'
      + '00:00:05.000 --> 00:00:07.000\nagain\n',
    );
  });

  it('rebases the inline word markers past an excluded window', () => {
    const output = serializer.serialize({
      document,
      granularity: 'word',
      skipRanges: [{ startSec: 0.25, endSec: 0.5 }],
    });
    expect(output).toContain('Hello <00:00:00.750>there');
  });
});

describe('SubViewer', () => {
  const serializer = new SbvSubtitleFileSerializer();

  it('writes an unpadded hour and no counter', () => {
    expect(serializer.serialize({ document, granularity: 'segment' })).toBe(
      '0:00:00.000,0:00:02.000\nHello there\n'
      + '\n'
      + '0:00:05.000,0:00:07.000\nagain\n',
    );
  });
});

describe('plain text', () => {
  const serializer = new TextSubtitleFileSerializer();

  it('writes the words and nothing else', () => {
    expect(serializer.serialize({ document, granularity: 'segment' })).toBe('Hello there\nagain\n');
  });

  it('reads the same however fine the timing asked for was', () => {
    expect(serializer.serialize({ document, granularity: 'word' }))
      .toBe(serializer.serialize({ document, granularity: 'segment' }));
  });
});

describe('TTML', () => {
  const serializer = new TtmlSubtitleFileSerializer();

  it('wraps each entry in a timed paragraph', () => {
    const output = serializer.serialize({ document, granularity: 'segment' });
    expect(output).toContain('<tt xmlns="http://www.w3.org/ns/ttml">');
    expect(output).toContain('<p begin="00:00:00.000" end="00:00:02.000">Hello there</p>');
    expect(output.trimEnd().endsWith('</tt>')).toBe(true);
  });

  it('times words with nested spans', () => {
    expect(serializer.serialize({ document, granularity: 'word' }))
      .toContain('<span begin="00:00:00.000" end="00:00:01.000">Hello</span>'
        + ' <span begin="00:00:01.000" end="00:00:02.000">there</span>');
  });

  it('escapes markup characters coming from the transcript', () => {
    const risky = new Document({
      sections: [new Section({ segments: [segment(word('<b>&', 0, 1))], kind: '' })],
    });
    expect(serializer.serialize({ document: risky, granularity: 'segment' }))
      .toContain('&lt;b&gt;&amp;');
  });
});

describe('Advanced SubStation Alpha', () => {
  const serializer = new AssSubtitleFileSerializer();

  it('declares a style and writes one dialogue line per entry', () => {
    const output = serializer.serialize({ document, granularity: 'segment' });
    expect(output).toContain('[V4+ Styles]');
    expect(output).toContain('Dialogue: 0,0:00:00.00,0:00:02.00,Default,,0,0,0,,Hello there');
    expect(output).toContain('Dialogue: 0,0:00:05.00,0:00:07.00,Default,,0,0,0,,again');
  });

  it('holds each word for its own span without splitting the line', () => {
    const output = serializer.serialize({ document, granularity: 'word' });
    expect(output).toContain(',,{\\k100}Hello {\\k100}there');
    expect(output.match(/^Dialogue:/gm)).toHaveLength(2);
  });

  // A dialogue line is read positionally against the format line, so a
  // count that disagrees pushes every field along and spills the extra
  // separators into the text.
  it('declares as many fields as its dialogue lines carry', () => {
    const output = serializer.serialize({ document, granularity: 'segment' });
    const eventsFormat = output.match(/^Format: Layer.*$/m)![0];
    const declared = eventsFormat.replace('Format: ', '').split(',').length;
    const dialogue = output.match(/^Dialogue: .*$/m)![0];
    const written = dialogue.replace('Dialogue: ', '').split(',').length;
    expect(written).toBe(declared);
    expect(eventsFormat).toContain('MarginV');
  });

  it('leaves the text where the format says the text begins', () => {
    const output = serializer.serialize({ document, granularity: 'segment' });
    const dialogue = output.match(/^Dialogue: .*$/m)![0];
    expect(dialogue.split(',').slice(9).join(',')).toBe('Hello there');
  });

  // `\k` tags run back to back, so anything the syllables fail to
  // account for makes every later word light up early.
  it('tiles the entry exactly, so nothing lights up ahead of the voice', () => {
    const paused = new Document({
      sections: [new Section({
        segments: [new Segment({
          lines: [new Line({ words: [word('spoken', 0.4, 1), word('later', 1.5, 1.9)] })],
          customTime: new TimeFragment(0, 2.5),
        })],
        kind: '',
      })],
    });
    const output = serializer.serialize({ document: paused, granularity: 'word' });
    const held = [...output.matchAll(/\{\\k(\d+)\}/g)].map((m) => Number(m[1]));
    expect(held.reduce((sum, value) => sum + value, 0)).toBe(250);
  });

  it('spends silence before the first word on an empty syllable', () => {
    const late = new Document({
      sections: [new Section({
        segments: [new Segment({
          lines: [new Line({ words: [word('late', 0.4, 1)] })],
          customTime: new TimeFragment(0, 1),
        })],
        kind: '',
      })],
    });
    expect(serializer.serialize({ document: late, granularity: 'word' }))
      .toContain(',,{\\k40}{\\k60}late');
  });

  it('holds a word through the silence that follows it', () => {
    const gapped = new Document({
      sections: [new Section({
        segments: [segment(word('first', 0, 0.5), word('second', 1.5, 2))], kind: '',
      })],
    });
    expect(serializer.serialize({ document: gapped, granularity: 'word' }))
      .toContain(',,{\\k150}first {\\k50}second');
  });

  it('disclaims braces so transcript text cannot open an override block', () => {
    const risky = new Document({
      sections: [new Section({ segments: [segment(word('{x}', 0, 1))], kind: '' })],
    });
    expect(serializer.serialize({ document: risky, granularity: 'segment' }))
      .toContain(',,\\{x\\}');
  });
});
