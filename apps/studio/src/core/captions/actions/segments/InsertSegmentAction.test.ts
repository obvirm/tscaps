import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, TimeFragment, Word, type AlignmentConfig, type SvgFilterDefinitions } from '@tscaps/engine';
import { EditorStore } from '@core/editor/store/EditorStore';
import { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import { EffectRegistry } from '@core/effect/services/EffectRegistry';
import { DecorationTimeResolver } from '@core/effect/services/DecorationTimeResolver';
import { InlineEmojiPunctuationAbsorber } from '@core/effect/services/InlineEmojiPunctuationAbsorber';
import { SegmentSplitterRegistry } from '@core/segment-splitter/services/SegmentSplitterRegistry';
import { LineSplitterRegistry } from '@core/line-splitter/services/LineSplitterRegistry';
import type { SheetCssVarsBuilder } from '@core/sheets/services/SheetCssVarsBuilder';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import { Template } from '@core/templates/domain/Template';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import { MAIN_SHEET_ID, Sheet } from '@core/sheets/domain/Sheet';
import { SegmentHardTime } from '@core/captions/services/SegmentHardTime';
import { SegmentTimeBounds } from '@core/captions/services/SegmentTimeBounds';
import { InsertSegmentAction } from '@core/captions/actions/segments/InsertSegmentAction';

/**
 * The first scene of a transcript that has none — what a video with no
 * speech in it opens with.
 *
 * A section's kind is the sheet its scenes are painted under, and the
 * first scene has no neighbour to inherit one from. It used to be born
 * under a kind naming no sheet at all, which the transcript renders
 * happily and the preview cannot paint: captions could be written and
 * read back in the panel while the video stayed bare.
 */

const ALIGNMENT: AlignmentConfig = {
  verticalAlign: 'bottom', verticalOffset: 0, horizontalAlign: 'center', horizontalOffset: 0,
};

const template = new Template(
  { id: 'plain', category: 'lab' } as unknown as TemplateMetadata,
  TYPOGRAPHY_DEFAULTS,
  ROTATION_DEFAULTS,
  ALIGNMENT,
  {} as RenderingConfig,
  {} as FeaturesConfig,
  {} as BehindActorTemplateConfig,
  [],
  [],
  { mode: 'none' } as unknown as LineSplitterConfig,
  [],
  [],
  {} as SvgFilterDefinitions,
  '',
  '',
  [],
);

const VIDEO_DURATION_SEC = 12;

function deriver(): DocumentDeriver {
  return new DocumentDeriver(
    [],
    new SegmentSplitterRegistry(),
    new LineSplitterRegistry(),
    new EffectRegistry(),
    {} as SheetCssVarsBuilder,
    new DecorationTimeResolver(),
    new InlineEmojiPunctuationAbsorber(),
  );
}

function actionOn(store: EditorStore): InsertSegmentAction {
  const hardTime = new SegmentHardTime();
  return new InsertSegmentAction(
    store,
    deriver(),
    () => VIDEO_DURATION_SEC,
    hardTime,
    new SegmentTimeBounds(hardTime),
  );
}

/** The editor as a speechless video leaves it: sheets, but no scenes. */
function storeWithEmptyTranscript(sheets: Sheet[], activeSheetId: string, sections: Section[] = []): EditorStore {
  const store = new EditorStore();
  store.patch({
    document: new Document({ sections }),
    sheets,
    activeSheetId,
    video: { duration: VIDEO_DURATION_SEC, isReady: true },
  });
  return store;
}

function sectionOfFirstScene(store: EditorStore): Section {
  const sections = store.snapshot().document!.sections;
  expect(sections).toHaveLength(1);
  return sections[0]!;
}

describe('the first scene of an empty transcript', () => {
  it('is written under a sheet the editor owns, so the preview can paint it', () => {
    const main = Sheet.createMain(template);
    const store = storeWithEmptyTranscript([main], MAIN_SHEET_ID);

    const wordId = actionOn(store).execute(0, 'before');

    expect(wordId).not.toBe('');
    const kind = sectionOfFirstScene(store).kind;
    expect(store.snapshot().sheets.map((sheet) => sheet.id)).toContain(kind);
  });

  it('lands on the sheet on screen rather than on Main', () => {
    const main = Sheet.createMain(template);
    const hook = Sheet.fromTemplate('hook', 'Hook', null, template, 'ltr');
    const store = storeWithEmptyTranscript([main, hook], 'hook');

    actionOn(store).execute(0, 'before');

    expect(sectionOfFirstScene(store).kind).toBe('hook');
  });

  it('falls back to Main when the sheet on screen is gone', () => {
    const main = Sheet.createMain(template);
    const store = storeWithEmptyTranscript([main], 'deleted-sheet');

    actionOn(store).execute(0, 'before');

    expect(sectionOfFirstScene(store).kind).toBe(MAIN_SHEET_ID);
  });

  // A document can still be carrying the section its transcription was
  // assembled into, emptied but not dropped. Reusing it keeps the id the
  // rest of the editor may already have written down.
  it('reuses the section the document still carries for that sheet', () => {
    const main = Sheet.createMain(template);
    const carried = new Section({ segments: [], kind: MAIN_SHEET_ID });
    const store = storeWithEmptyTranscript([main], MAIN_SHEET_ID, [carried]);

    actionOn(store).execute(0, 'before');

    expect(sectionOfFirstScene(store).id).toBe(carried.id);
  });
});

/**
 * Index 0 names the first scene, never the absence of one — the two used
 * to be told apart by whether an anchor was found, which reads as the
 * same question and is not.
 */
describe('a scene inserted beside an existing one', () => {
  function transcriptOnOneSheet(): EditorStore {
    const spoken = new Segment({ lines: [new Line({ words: [
      new Word({ text: 'already', time: new TimeFragment(2, 3) }),
      new Word({ text: 'here', time: new TimeFragment(3, 4) }),
    ] })] });
    const store = storeWithEmptyTranscript(
      [Sheet.createMain(template)],
      MAIN_SHEET_ID,
      [new Section({ segments: [spoken], kind: MAIN_SHEET_ID })],
    );
    return store;
  }

  it('lands before the scene at index 0 rather than replacing the document', () => {
    const store = transcriptOnOneSheet();

    const wordId = actionOn(store).execute(0, 'before');

    expect(wordId).not.toBe('');
    const segments = store.snapshot().document!.getSegments();
    expect(segments).toHaveLength(2);
    expect(segments[1]!.getText()).toContain('already');
  });

  it('stays in the anchor own sheet, whatever the sidebar has selected', () => {
    const store = transcriptOnOneSheet();
    const hook = Sheet.fromTemplate('hook', 'Hook', null, template, 'ltr');
    store.patch({ sheets: [...store.snapshot().sheets, hook], activeSheetId: 'hook' });

    actionOn(store).execute(0, 'after');

    const sections = store.snapshot().document!.sections;
    expect(sections.map((section) => section.kind)).toEqual([MAIN_SHEET_ID]);
  });

  it('refuses an index no scene sits at', () => {
    const store = transcriptOnOneSheet();

    expect(actionOn(store).execute(7, 'after')).toBe('');
    expect(store.snapshot().document!.getSegments()).toHaveLength(1);
  });
});
