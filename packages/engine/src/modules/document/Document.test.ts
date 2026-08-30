import { describe, expect, it } from 'vitest';
import { Document } from '@modules/document/Document';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';
import { NarrationPace } from '@modules/document/NarrationPace';

/**
 * What survives cloning a Document. A property one clone path forgets
 * is not an error anywhere — it is just gone, and whoever set it never
 * finds out.
 */

function documentOf(): Document {
  const words = ['no', 'one', 'told', 'me'].map((text, index) =>
    new Word({ text, time: new TimeFragment(index, index + 1) }));
  return new Document({
    sections: [new Section({ segments: [new Segment({ lines: [new Line({ words })] })], kind: 'main' })],
    narrationPace: NarrationPace.fromWords(words),
    language: 'es',
  });
}

describe('Document', () => {

  it('has no language until one is given', () => {
    expect(new Document({ sections: [] }).language).toBeNull();
  });

  it('keeps the language through with()', () => {
    expect(documentOf().with({ sections: [] }).language).toBe('es');
  });

  it('keeps the language through withSegments()', () => {
    expect(documentOf().withSegments([]).language).toBe('es');
  });

  it('keeps the language through withMetadata()', () => {
    expect(documentOf().withMetadata({ any: 'thing' }).language).toBe('es');
  });

  it('lets with() replace the language', () => {
    expect(documentOf().with({ language: 'pt' }).language).toBe('pt');
  });

  it('keeps the narration pace through every clone path', () => {
    const original = documentOf();
    expect(original.narrationPace.isEmpty()).toBe(false);
    expect(original.with({ sections: [] }).narrationPace.toRecord()).toEqual(original.narrationPace.toRecord());
    expect(original.withSegments([]).narrationPace.toRecord()).toEqual(original.narrationPace.toRecord());
    expect(original.withMetadata(null).narrationPace.toRecord()).toEqual(original.narrationPace.toRecord());
  });
});
