import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, Tag, TimeFragment, Word } from '@tscaps/engine';
import { Sheet } from '@core/sheets/domain/Sheet';
import { SHEET_ROLES } from '@core/sheets/domain/SheetRole';
import { SpeakerSheetMatcher } from '@core/sheet-matchers/services/SpeakerSheetMatcher';
import { SheetCreationOptionFinder } from '@core/sheets/services/SheetCreationOptionFinder';

/**
 * What the "+" is allowed to offer.
 *
 * Every option promises content the sheet will arrive holding. Offering
 * one with nothing behind it — a role already added, a voice already
 * split out, a transcript with a single speaker — creates an empty sheet
 * and reads as a button that did nothing.
 */

const finder = new SheetCreationOptionFinder(new SpeakerSheetMatcher());

function word(text: string, speakerId: string | null, tagNames: string[] = []): Word {
  return new Word({
    text,
    time: new TimeFragment(0, 1),
    speakerId,
    semanticTags: new Set(tagNames.map((name) => Tag.of(name))),
  });
}

function scene(words: Word[]): Segment {
  return new Segment({ lines: [new Line({ words })] });
}

function documentOf(sections: { kind: string; scenes: Segment[] }[]): Document {
  return new Document({
    sections: sections.map((s) => new Section({ kind: s.kind, segments: s.scenes })),
  });
}

function underMain(scenes: Segment[]): Document {
  return documentOf([{ kind: 'main', scenes }]);
}

function sheetNamed(id: string): Sheet {
  return { id } as unknown as Sheet;
}

const MAIN_ONLY = [sheetNamed('main')];

describe('the roles the "+" offers', () => {
  it('offers a role whose tag marked something and whose sheet is missing', () => {
    const document = underMain([scene([word('rest', null, ['peak'])])]);
    expect(finder.find(document, MAIN_ONLY)).toEqual([{ kind: 'role', role: 'peak' }]);
  });

  it('withholds a role whose sheet the project already has', () => {
    const document = underMain([scene([word('rest', null, ['peak'])])]);
    const sheets = [...MAIN_ONLY, sheetNamed(SHEET_ROLES.peak.sheetId)];
    expect(finder.find(document, sheets)).toEqual([]);
  });

  it('withholds a role no word was tagged for', () => {
    const document = underMain([scene([word('rest', null, ['emphasis'])])]);
    expect(finder.find(document, MAIN_ONLY)).toEqual([]);
  });

  it('offers nothing before there is a transcript to read', () => {
    expect(finder.find(null, MAIN_ONLY)).toEqual([]);
  });
});

describe('the speakers the "+" offers', () => {
  const twoVoices = () => underMain([
    scene([word('hello', 'a')]),
    scene([word('hi', 'b')]),
  ]);

  it('offers every voice past the first, which stays on Main', () => {
    expect(finder.find(twoVoices(), MAIN_ONLY)).toEqual([
      { kind: 'speaker', speakerId: 'b', name: 'Speaker 2', position: 1 },
    ]);
  });

  it('numbers voices by when they first speak', () => {
    const document = underMain([
      scene([word('hello', 'a')]),
      scene([word('hi', 'b')]),
      scene([word('hey', 'c')]),
    ]);
    expect(finder.find(document, MAIN_ONLY).map((o) => o.kind === 'speaker' && o.name))
      .toEqual(['Speaker 2', 'Speaker 3']);
  });

  it('offers nothing when a single voice carries the whole transcript', () => {
    expect(finder.find(underMain([scene([word('hello', 'a')])]), MAIN_ONLY)).toEqual([]);
  });

  it('drops a voice whose scenes already left Main', () => {
    const document = documentOf([
      { kind: 'main', scenes: [scene([word('hello', 'a')])] },
      { kind: 'other', scenes: [scene([word('hi', 'b')])] },
    ]);
    expect(finder.find(document, MAIN_ONLY)).toEqual([]);
  });

  it('ignores words nobody was credited with', () => {
    const document = underMain([
      scene([word('hello', null)]),
      scene([word('hi', 'a')]),
      scene([word('hey', 'b')]),
    ]);
    expect(finder.find(document, MAIN_ONLY).map((o) => o.kind === 'speaker' && o.name))
      .toEqual(['Speaker 2']);
  });

  it('offers a voice that only ever speaks inside a scene it shares', () => {
    const document = underMain([scene([word('hello', 'a'), word('hi', 'b')])]);
    expect(finder.find(document, MAIN_ONLY)).toEqual([
      { kind: 'speaker', speakerId: 'b', name: 'Speaker 2', position: 1 },
    ]);
  });
});

describe('a project with both on offer', () => {
  it('lists the roles before the speakers', () => {
    const document = underMain([
      scene([word('hello', 'a', ['hook'])]),
      scene([word('hi', 'b')]),
    ]);
    expect(finder.find(document, MAIN_ONLY).map((o) => o.kind)).toEqual(['role', 'speaker']);
  });
});
