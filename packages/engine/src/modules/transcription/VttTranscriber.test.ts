import { describe, expect, it } from 'vitest';
import { Document } from '@modules/document/Document';
import { Line } from '@modules/document/Line';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { TimeFragment } from '@modules/document/TimeFragment';
import { Word } from '@modules/document/Word';
import { VttSubtitleFileSerializer } from '@modules/subtitle-file/VttSubtitleFileSerializer';
import { VttTranscriber } from '@modules/transcription/VttTranscriber';

const NO_AUDIO = new Blob([]);

async function parse(source: string) {
  return new VttTranscriber(source).transcribe(NO_AUDIO);
}

describe('VttTranscriber', () => {

  it('skips the header and reads the cues below it', async () => {
    const document = await parse(
      'WEBVTT\n\n'
      + '00:00:01.000 --> 00:00:03.000\nHello there\n\n'
      + '00:00:04.000 --> 00:00:05.000\nSecond cue\n',
    );
    expect(document.getSegments()).toHaveLength(2);
    expect(document.getSegments()[0]!.time.start).toBeCloseTo(1);
  });

  it('ignores note, style and region blocks', async () => {
    const document = await parse(
      'WEBVTT\n\n'
      + 'NOTE this is a comment\n\n'
      + 'STYLE\n::cue { color: red }\n\n'
      + 'REGION\nid:r1\n\n'
      + '00:00:00.000 --> 00:00:01.000\nkept\n',
    );
    expect(document.getSegments()).toHaveLength(1);
    expect(document.getLines()[0]!.getText()).toBe('kept');
  });

  it('reads a cue carrying an identifier above its timecode', async () => {
    const document = await parse('WEBVTT\n\ncue-1\n00:00:00.000 --> 00:00:01.000\nwith id\n');
    expect(document.getLines()[0]!.getText()).toBe('with id');
  });

  it('drops styling tags from the cue text', async () => {
    const document = await parse(
      'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n<c.yellow>Styled</c> <b>word</b>\n',
    );
    expect(document.getLines()[0]!.getText()).toBe('Styled word');
  });

  it('spreads the words across the cue when it says nothing about them', async () => {
    const document = await parse('WEBVTT\n\n00:00:00.000 --> 00:00:10.000\naaaa b\n');
    const [first, second] = document.getWords();
    expect(first!.time.end).toBeCloseTo(8);
    expect(second!.time.start).toBeCloseTo(8);
  });

  it('returns an empty document for a header with no cues', async () => {
    expect((await parse('WEBVTT\n\n')).getSegments()).toEqual([]);
  });

  // Reported from the field: a blank line inside a cue payload splits
  // it in two, and the half without the timecode used to take the
  // whole file down with it.
  it('keeps the readable cues when a blank line splits a cue payload', async () => {
    const document = await parse(
      'WEBVTT\n\n'
      + '00:00:01.000 --> 00:00:04.000\nfirst half\n\n'
      + 'second half, orphaned\n\n'
      + '00:00:05.000 --> 00:00:08.000\nintact cue\n',
    );
    expect(document.getLines().map((line) => line.getText())).toEqual(['first half', 'intact cue']);
  });

  // A STYLE block whose CSS contains a blank line is two blocks as far
  // as the format is concerned, and the second one looks like a cue
  // with no timecode.
  it('keeps the cues when a style block is broken up by a blank line', async () => {
    const document = await parse(
      'WEBVTT\n\n'
      + 'STYLE\n::cue {\n  color: yellow;\n}\n\n'
      + '::cue(b) {\n  color: red;\n}\n\n'
      + '00:00:01.000 --> 00:00:04.000\nkept\n',
    );
    expect(document.getLines().map((line) => line.getText())).toEqual(['kept']);
  });

  it('announces every block it skipped', async () => {
    const transcriber = new VttTranscriber(
      'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nkept\n\norphan one\n\norphan two\n',
    );
    const skipped: string[] = [];
    transcriber.onSkippedCueBlock = (block) => skipped.push(block);

    await transcriber.transcribe(NO_AUDIO);

    expect(skipped).toEqual(['orphan one', 'orphan two']);
  });

  it('refuses a file in which no block carries a timecode line', async () => {
    await expect(parse('WEBVTT\n\nnot a cue\n\nnot a cue either\n')).rejects.toThrow(/timecode/);
  });

  describe('cues marking when each word is spoken', () => {

    it('takes the marks as the word timings instead of guessing', async () => {
      const document = await parse(
        'WEBVTT\n\n00:00:00.000 --> 00:00:03.000\naaaa <00:00:02.000>b\n',
      );
      const [first, second] = document.getWords();
      // Left to guess, the long word would have taken four fifths of
      // the cue and the short one would start at 2.4.
      expect(first!.time.end).toBeCloseTo(2);
      expect(second!.time.start).toBeCloseTo(2);
      expect(second!.time.end).toBeCloseTo(3);
    });

    it('shares out the words between two marks', async () => {
      const document = await parse(
        'WEBVTT\n\n00:00:00.000 --> 00:00:04.000\na <00:00:02.000>bb cc\n',
      );
      const [, second, third] = document.getWords();
      expect(second!.time.start).toBeCloseTo(2);
      expect(second!.time.end).toBeCloseTo(3);
      expect(third!.time.start).toBeCloseTo(3);
    });

    it('reads a mark that leaves out the hour', async () => {
      const document = await parse('WEBVTT\n\n00:00.000 --> 00:04.000\na <00:02.000>b\n');
      expect(document.getWords()[1]!.time.start).toBeCloseTo(2);
    });

    it('keeps styling tags out of the words that surround a mark', async () => {
      const document = await parse(
        'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n<c.y>one</c> <00:00:01.000><b>two</b>\n',
      );
      expect(document.getLines()[0]!.getText()).toBe('one two');
      expect(document.getWords()[1]!.time.start).toBeCloseTo(1);
    });
  });

  // Writing word timing into a file we cannot read back would leave the
  // editor unable to reopen its own export at the precision it wrote.
  describe('reading back what the writer produced', () => {
    const spoken = new Document({
      sections: [new Section({
        kind: '',
        segments: [new Segment({
          lines: [new Line({
            words: [
              new Word({ text: 'one', time: new TimeFragment(0, 0.5) }),
              new Word({ text: 'two', time: new TimeFragment(1, 1.5) }),
              new Word({ text: 'three', time: new TimeFragment(2, 2.5) }),
            ],
          })],
        })],
      })],
    });

    const written = new VttSubtitleFileSerializer()
      .serialize({ document: spoken, granularity: 'word' });

    it('recovers the words', async () => {
      const document = await new VttTranscriber(written).transcribe(NO_AUDIO);
      expect(document.getWords().map((word) => word.text)).toEqual(['one', 'two', 'three']);
    });

    it('recovers every word onset exactly', async () => {
      const document = await new VttTranscriber(written).transcribe(NO_AUDIO);
      expect(document.getWords().map((word) => word.time.start)).toEqual([0, 1, 2]);
    });

    // A mark says when a word starts and the format has no way to say
    // when one stops, so a word reaches to the next and the silence
    // after it cannot survive the trip.
    it('stretches each word to the next, having nowhere to record silence', async () => {
      const document = await new VttTranscriber(written).transcribe(NO_AUDIO);
      expect(document.getWords().map((word) => word.time.end)).toEqual([1, 2, 2.5]);
    });
  });
});
