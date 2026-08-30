import { describe, expect, it } from 'vitest';
import type { AlignmentConfig, Document, SvgFilterDefinitions } from '@tscaps/engine';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { StartBehindActorAnalysisAction } from '@core/person-segmentation/actions/StartBehindActorAnalysisAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import { Sheet } from '@core/sheets/domain/Sheet';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import { Template } from '@core/templates/domain/Template';
import { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import { PersonSegmentationFlowStore } from '@core/person-segmentation/store/PersonSegmentationFlowStore';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';
import { CaptionedRangeCollector } from '@core/person-segmentation/services/CaptionedRangeCollector';
import { PassingWindowFinder } from '@core/person-segmentation/services/PassingWindowFinder';
import { PersonSegmentationResultAssembler } from '@core/person-segmentation/services/PersonSegmentationResultAssembler';
import { PersonSegmentationResultReader } from '@core/person-segmentation/services/PersonSegmentationResultReader';
import { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';
import { BehindActorPreviewSupportChecker } from '@core/person-segmentation/services/BehindActorPreviewSupportChecker';
import { PersonSegmentationTriggerAutomation } from '@core/person-segmentation/automations/PersonSegmentationTriggerAutomation';

/**
 * Reaching for a template that needs the actor cut out of the shot.
 *
 * The automation is a one-shot opt-in: once the user says yes for a
 * project, the analyzer takes over and nothing here asks again. What
 * it has to decide before that is only whether the user has ever
 * agreed for this project — either just now (kept in memory) or on
 * some earlier session (visible as `analyzedRanges` on the persisted
 * record). Coverage of the current captions is not the gate: the
 * playback gate covers the frames the analyzer has not reached yet,
 * and asking again while that happens is what caused the dialog to
 * reopen every time the active sheet flipped across a section
 * boundary onto a behind-actor sheet.
 */

const PROJECT_ID = 'project-1';
const BEHIND_ACTOR_SHEET_ID = 'main';
const PLAIN_SHEET_ID = 'other';

/** A document holding one caption on each sheet, painted at the given stretches. */
function documentWithSectionsAt(sections: ReadonlyArray<{ kind: string; start: number; end: number }>): Document {
  return {
    sections: sections.map((section) => ({
      kind: section.kind,
      segments: [{ time: { start: section.start, end: section.end } }],
    })),
  } as unknown as Document;
}

const assembler = new PersonSegmentationResultAssembler(new PassingWindowFinder());

/** What a run scoped to `analyzed` leaves behind when it found no usable scene there. */
function examinedButUnusable(analyzed: TimeRangeSet): PersonSegmentationResult {
  return assembler.assemble(analyzed, [{ t: analyzed.list()[0]!.start, passes: false }], new MaskCache());
}

const ALIGNMENT: AlignmentConfig = {
  verticalAlign: 'bottom', verticalOffset: 0, horizontalAlign: 'left', horizontalOffset: 0,
};

function templateWith(id: string, behindActor: BehindActorTemplateConfig): Template {
  return new Template(
    { id, category: 'lab' } as unknown as TemplateMetadata,
    TYPOGRAPHY_DEFAULTS,
    ROTATION_DEFAULTS,
    ALIGNMENT,
    {} as RenderingConfig,
    {} as FeaturesConfig,
    behindActor,
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
}

const plainTemplate = templateWith('plain', { required: false, tagCondition: null });
const behindActorTemplate = templateWith('needs-actor', { required: true, tagCondition: null });

function sheetOn(id: string, template: Template): Sheet {
  return new Sheet({
    id,
    name: id,
    color: null,
    template,
    variantIndex: 0,
    styleValues: StyleValues.fromTemplateVariant(template, 0),
    typographyConfig: TYPOGRAPHY_DEFAULTS,
    rotationConfig: ROTATION_DEFAULTS,
    segmentSplitterConfigs: [],
    lineSplitterConfig: { mode: 'none' } as unknown as LineSplitterConfig,
    alignmentConfig: ALIGNMENT,
    effectConfigs: [],
    linkGroupId: null,
  });
}

class InMemoryPersonSegmentationCacheRepository implements PersonSegmentationCacheRepository {
  private readonly byProject = new Map<string, PersonSegmentationResult>();

  async load(projectId: string): Promise<PersonSegmentationResult | null> {
    return this.byProject.get(projectId) ?? null;
  }

  async store(projectId: string, result: PersonSegmentationResult): Promise<void> {
    this.byProject.set(projectId, result);
  }

  async delete(projectId: string): Promise<void> {
    this.byProject.delete(projectId);
  }
}

function cacheHoldingOneMask(): MaskCache {
  const cache = new MaskCache();
  cache.add({ t: 1.5, alpha: new Uint8Array([255]), width: 1, height: 1 });
  return cache;
}

/** Counts how many times the silent start was fired. */
class RecordedStartAnalysis {
  starts = 0;

  readonly action = {
    execute: async (): Promise<void> => { this.starts++; },
  } as unknown as StartBehindActorAnalysisAction;
}

interface AutomationHarness {
  readonly store: EditorStore;
  readonly repository: InMemoryPersonSegmentationCacheRepository;
  readonly loadedStore: LoadedPersonSegmentationCacheStore;
  readonly flowStore: PersonSegmentationFlowStore;
  readonly automation: PersonSegmentationTriggerAutomation;
  readonly startAnalysis: RecordedStartAnalysis;
}

/**
 * Puts the store on a proxy preview and returns the real checker over
 * it, which is what the effect needs to be renderable at all.
 */
function playingProxy(store: EditorStore): BehindActorPreviewSupportChecker {
  store.patchVideo({ preview: { kind: 'proxy', file: new Blob(['proxy']) } });
  return new BehindActorPreviewSupportChecker(true, store);
}

function startedHarness(): AutomationHarness {
  const store = new EditorStore();
  store.patch({
    projectId: PROJECT_ID,
    sheets: [sheetOn(BEHIND_ACTOR_SHEET_ID, plainTemplate)],
    activeSheetId: BEHIND_ACTOR_SHEET_ID,
    document: documentWithSectionsAt([{ kind: BEHIND_ACTOR_SHEET_ID, start: 1, end: 3 }]),
  });
  const repository = new InMemoryPersonSegmentationCacheRepository();
  const loadedStore = new LoadedPersonSegmentationCacheStore();
  const flowStore = new PersonSegmentationFlowStore();
  const startAnalysis = new RecordedStartAnalysis();
  const automation = new PersonSegmentationTriggerAutomation(
    store,
    new CaptionedRangeCollector(),
    new PersonSegmentationResultReader(repository, loadedStore),
    startAnalysis.action,
    flowStore,
    { execute: () => {} } as unknown as RefreshDocumentAction,
    playingProxy(store),
  );
  automation.start();
  return { store, repository, loadedStore, flowStore, automation, startAnalysis };
}

/**
 * Switches the active sheet's template to the behind-actor one and
 * settles the automation's async cache lookup.
 */
async function pickBehindActorTemplateOn(store: EditorStore): Promise<void> {
  store.patch({ sheets: [sheetOn(BEHIND_ACTOR_SHEET_ID, behindActorTemplate)] });
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Lets any pending microtask inside the automation resolve before the assertion reads the flow. */
function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('offering the scan behind the text-behind-actor effect', () => {
  it('offers nothing while the original is playing — the effect could not paint anyway', async () => {
    const { store, flowStore, startAnalysis } = startedHarness();
    store.patchVideo({ preview: { kind: 'original', file: new Blob(['source']), reason: 'policy-skipped' } });

    await pickBehindActorTemplateOn(store);

    expect(flowStore.status.mode).toBe('closed');
    expect(startAnalysis.starts).toBe(0);
  });

  it('offers it when the only cached masks came from a segment forced on by hand', async () => {
    const { store, repository, flowStore } = startedHarness();
    await repository.store(PROJECT_ID, PersonSegmentationResult.nothingKnown(cacheHoldingOneMask()));

    await pickBehindActorTemplateOn(store);

    expect(flowStore.status.mode).toBe('confirm');
  });

  it('lets it go once a run has left something on record, even nothing usable', async () => {
    const { store, repository, flowStore } = startedHarness();
    await repository.store(PROJECT_ID, examinedButUnusable(TimeRangeSet.of([{ start: 0, end: 10 }])));

    await pickBehindActorTemplateOn(store);

    expect(flowStore.status.mode).toBe('closed');
  });

  it('offers it on a project nothing has ever been measured for', async () => {
    const { store, flowStore } = startedHarness();

    await pickBehindActorTemplateOn(store);

    expect(flowStore.status.mode).toBe('confirm');
  });

  it('stays quiet when the caption on screen is painted with a template that never lifts it', async () => {
    const { store, flowStore } = startedHarness();

    store.patch({
      document: documentWithSectionsAt([{ kind: 'unrelated-sheet', start: 1, end: 3 }]),
    });
    await pickBehindActorTemplateOn(store);

    expect(flowStore.status.mode).toBe('closed');
  });

  it('stays quiet on a video with no captions, where there is nothing to measure for', async () => {
    const { store, flowStore } = startedHarness();
    store.patch({ document: { sections: [] } as unknown as Document });

    await pickBehindActorTemplateOn(store);

    expect(flowStore.status.mode).toBe('closed');
  });

  it('does not reopen after the user accepts, even when the active sheet flips onto the behind-actor one again', async () => {
    const { store, loadedStore, flowStore, automation } = startedHarness();
    store.patch({
      sheets: [sheetOn(BEHIND_ACTOR_SHEET_ID, behindActorTemplate), sheetOn(PLAIN_SHEET_ID, plainTemplate)],
      document: documentWithSectionsAt([
        { kind: BEHIND_ACTOR_SHEET_ID, start: 0, end: 2 },
        { kind: PLAIN_SHEET_ID, start: 2, end: 4 },
        { kind: BEHIND_ACTOR_SHEET_ID, start: 4, end: 6 },
      ]),
    });
    await settled();
    expect(flowStore.status.mode).toBe('confirm');

    // The dialog closes on accept, and the analyzer publishes the head start.
    flowStore.finishRunning();
    loadedStore.publish(PROJECT_ID, assembler.assemble(
      TimeRangeSet.of([{ start: 0, end: 1 }]),
      [{ t: 0, passes: true }],
      new MaskCache(),
    ));
    automation.noteAcceptance();

    store.patch({ activeSheetId: PLAIN_SHEET_ID });
    await settled();
    store.patch({ activeSheetId: BEHIND_ACTOR_SHEET_ID });
    await settled();

    expect(flowStore.status.mode).toBe('closed');
  });

  it('offers it again when the user cancels and re-picks the template, since cancel is not opt-in', async () => {
    const { store, flowStore } = startedHarness();
    await pickBehindActorTemplateOn(store);
    expect(flowStore.status.mode).toBe('confirm');

    flowStore.close();
    store.patch({ sheets: [sheetOn(BEHIND_ACTOR_SHEET_ID, plainTemplate)] });
    await settled();
    await pickBehindActorTemplateOn(store);

    expect(flowStore.status.mode).toBe('confirm');
  });

  it('remembers the acceptance across a project with no persisted id, where nothing gets written', async () => {
    const store = new EditorStore();
    store.patch({
      projectId: null,
      sheets: [sheetOn(BEHIND_ACTOR_SHEET_ID, plainTemplate), sheetOn(PLAIN_SHEET_ID, plainTemplate)],
      activeSheetId: BEHIND_ACTOR_SHEET_ID,
      document: documentWithSectionsAt([
        { kind: BEHIND_ACTOR_SHEET_ID, start: 0, end: 2 },
        { kind: PLAIN_SHEET_ID, start: 2, end: 4 },
      ]),
    });
    const repository = new InMemoryPersonSegmentationCacheRepository();
    const loadedStore = new LoadedPersonSegmentationCacheStore();
    const flowStore = new PersonSegmentationFlowStore();
    const startAnalysis = new RecordedStartAnalysis();
    const automation = new PersonSegmentationTriggerAutomation(
      store,
      new CaptionedRangeCollector(),
      new PersonSegmentationResultReader(repository, loadedStore),
      startAnalysis.action,
      flowStore,
      { execute: () => {} } as unknown as RefreshDocumentAction,
      playingProxy(store),
    );
    automation.start();
    await pickBehindActorTemplateOn(store);
    expect(flowStore.status.mode).toBe('confirm');

    flowStore.finishRunning();
    automation.noteAcceptance();
    store.patch({ activeSheetId: PLAIN_SHEET_ID });
    await settled();
    store.patch({ activeSheetId: BEHIND_ACTOR_SHEET_ID });
    await settled();

    expect(flowStore.status.mode).toBe('closed');
  });

  it('starts silently on a project loaded with the behind-actor template already in place', async () => {
    const store = new EditorStore();
    store.patch({
      projectId: PROJECT_ID,
      sheets: [sheetOn(BEHIND_ACTOR_SHEET_ID, behindActorTemplate)],
      activeSheetId: BEHIND_ACTOR_SHEET_ID,
      document: documentWithSectionsAt([{ kind: BEHIND_ACTOR_SHEET_ID, start: 1, end: 3 }]),
    });
    const repository = new InMemoryPersonSegmentationCacheRepository();
    const loadedStore = new LoadedPersonSegmentationCacheStore();
    const flowStore = new PersonSegmentationFlowStore();
    const startAnalysis = new RecordedStartAnalysis();
    new PersonSegmentationTriggerAutomation(
      store,
      new CaptionedRangeCollector(),
      new PersonSegmentationResultReader(repository, loadedStore),
      startAnalysis.action,
      flowStore,
      { execute: () => {} } as unknown as RefreshDocumentAction,
      playingProxy(store),
    ).start();
    await settled();

    expect(flowStore.status.mode).toBe('closed');
    expect(startAnalysis.starts).toBe(1);
  });

  it('starts silently when the active sheet switches onto a behind-actor sheet the user has not touched', async () => {
    const { store, flowStore, startAnalysis } = startedHarness();
    store.patch({
      sheets: [sheetOn(BEHIND_ACTOR_SHEET_ID, plainTemplate), sheetOn(PLAIN_SHEET_ID, behindActorTemplate)],
      document: documentWithSectionsAt([
        { kind: BEHIND_ACTOR_SHEET_ID, start: 0, end: 2 },
        { kind: PLAIN_SHEET_ID, start: 2, end: 4 },
      ]),
    });
    await settled();
    const startsBefore = startAnalysis.starts;

    store.patch({ activeSheetId: PLAIN_SHEET_ID });
    await settled();

    expect(flowStore.status.mode).toBe('closed');
    expect(startAnalysis.starts).toBe(startsBefore + 1);
  });

  it('does not fire the silent start twice when the same active sheet flips away and back', async () => {
    const { store, flowStore, startAnalysis } = startedHarness();
    store.patch({
      sheets: [sheetOn(BEHIND_ACTOR_SHEET_ID, plainTemplate), sheetOn(PLAIN_SHEET_ID, behindActorTemplate)],
      document: documentWithSectionsAt([
        { kind: BEHIND_ACTOR_SHEET_ID, start: 0, end: 2 },
        { kind: PLAIN_SHEET_ID, start: 2, end: 4 },
      ]),
    });
    store.patch({ activeSheetId: PLAIN_SHEET_ID });
    await settled();
    const startsAfterFirstSwitch = startAnalysis.starts;

    store.patch({ activeSheetId: BEHIND_ACTOR_SHEET_ID });
    await settled();
    store.patch({ activeSheetId: PLAIN_SHEET_ID });
    await settled();

    expect(flowStore.status.mode).toBe('closed');
    expect(startAnalysis.starts).toBe(startsAfterFirstSwitch);
  });

  it('does not fire the silent start on a project that has already been examined', async () => {
    const { store, repository, startAnalysis } = startedHarness();
    await repository.store(PROJECT_ID, examinedButUnusable(TimeRangeSet.of([{ start: 0, end: 10 }])));
    store.patch({
      sheets: [sheetOn(BEHIND_ACTOR_SHEET_ID, plainTemplate), sheetOn(PLAIN_SHEET_ID, behindActorTemplate)],
      document: documentWithSectionsAt([
        { kind: BEHIND_ACTOR_SHEET_ID, start: 0, end: 2 },
        { kind: PLAIN_SHEET_ID, start: 2, end: 4 },
      ]),
    });

    store.patch({ activeSheetId: PLAIN_SHEET_ID });
    await settled();

    expect(startAnalysis.starts).toBe(0);
  });
});
