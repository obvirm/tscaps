import { describe, expect, it } from 'vitest';
import { SrtTranscriber } from '@modules/transcription/SrtTranscriber';

const NO_AUDIO = new Blob([]);

async function parse(source: string) {
  return new SrtTranscriber(source).transcribe(NO_AUDIO);
}

describe('SrtTranscriber', () => {

  it('turns each cue into a segment carrying the cue range', async () => {
    const document = await parse(
      '1\n00:00:01,000 --> 00:00:03,000\nHello there\n\n'
      + '2\n00:00:04,500 --> 00:00:06,000\nSecond cue\n',
    );
    const segments = document.getSegments();
    expect(segments).toHaveLength(2);
    expect(segments[0]!.time.start).toBeCloseTo(1);
    expect(segments[0]!.time.end).toBeCloseTo(3);
    expect(segments[1]!.time.start).toBeCloseTo(4.5);
  });

  // Nothing in the file says when a word is spoken, so the cue is split
  // by how long each word is to write.
  it('spreads the words across the cue by their length', async () => {
    const document = await parse('1\n00:00:00,000 --> 00:00:10,000\naaaa b\n');
    const [first, second] = document.getWords();
    expect(first!.time.start).toBeCloseTo(0);
    expect(first!.time.end).toBeCloseTo(8);
    expect(second!.time.start).toBeCloseTo(8);
    expect(second!.time.end).toBeCloseTo(10);
  });

  it('accepts a dot as the millisecond separator', async () => {
    const document = await parse('1\n00:00:01.250 --> 00:00:02.750\nx\n');
    expect(document.getSegments()[0]!.time.start).toBeCloseTo(1.25);
    expect(document.getSegments()[0]!.time.end).toBeCloseTo(2.75);
  });

  it('joins a multi-line cue into one line and drops formatting tags', async () => {
    const document = await parse('1\n00:00:00,000 --> 00:00:02,000\n<i>Top</i>\n{\\an8}bottom\n');
    expect(document.getLines()[0]!.getText()).toBe('Top bottom');
  });

  it('reads a cue with no counter above the timecode', async () => {
    const document = await parse('00:00:00,000 --> 00:00:01,000\nno counter\n');
    expect(document.getLines()[0]!.getText()).toBe('no counter');
  });

  it('returns an empty document for a source with no cues', async () => {
    expect((await parse('')).getSegments()).toEqual([]);
  });

  it('refuses a file in which no block carries a timecode line', async () => {
    await expect(parse('1\njust text\n')).rejects.toThrow(/timecode/);
  });

  it('keeps the readable cues when one block carries no timecode', async () => {
    const document = await parse(
      '1\n00:00:00,000 --> 00:00:01,000\nfirst\n\n'
      + 'stray text nobody timed\n\n'
      + '2\n00:00:02,000 --> 00:00:03,000\nsecond\n',
    );
    expect(document.getLines().map((line) => line.getText())).toEqual(['first', 'second']);
  });

  it('announces every block it skipped', async () => {
    const transcriber = new SrtTranscriber(
      '1\n00:00:00,000 --> 00:00:01,000\nfirst\n\nstray one\n\nstray two\n',
    );
    const skipped: string[] = [];
    transcriber.onSkippedCueBlock = (block) => skipped.push(block);

    await transcriber.transcribe(new Blob([]));

    expect(skipped).toEqual(['stray one', 'stray two']);
  });

  it('refuses a range that ends before it starts', async () => {
    await expect(parse('1\n00:00:05,000 --> 00:00:02,000\nx\n')).rejects.toThrow(/ends before/);
  });
});
