import { describe, expect, it } from 'vitest';
import { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';
import { PassingWindowFinder } from '@core/person-segmentation/services/PassingWindowFinder';
import { PersonSegmentationResultAssembler } from '@core/person-segmentation/services/PersonSegmentationResultAssembler';
import { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';
import { PersonSegmentationResultReader } from '@core/person-segmentation/services/PersonSegmentationResultReader';

/**
 * Asking what the actor-cutout effect has to work with.
 *
 * Preview and export both ask this, and they have to get the same
 * answer — the effect is composited twice, once on screen and once
 * into the file, and a user who lines up a shot in the editor is
 * promising themselves the export. A project the user never saved has
 * its result in memory and nowhere else, so an answer sourced from
 * storage alone would tell the export the effect is off while the
 * editor plays it.
 */

const PROJECT_ID = 'project-1';

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

const assembler = new PersonSegmentationResultAssembler(new PassingWindowFinder());

function resultOverOneWindow(): PersonSegmentationResult {
  return assembler.assemble(TimeRangeSet.of([{ start: 0, end: 5 }]), [], new MaskCache());
}

describe('asking what the actor-cutout effect has to work with', () => {
  it('answers from memory on a session that never persisted a project', async () => {
    const loadedStore = new LoadedPersonSegmentationCacheStore();
    const scanned = resultOverOneWindow();
    loadedStore.publish(null, scanned);
    const reader = new PersonSegmentationResultReader(new InMemoryPersonSegmentationCacheRepository(), loadedStore);

    expect(await reader.read(null)).toBe(scanned);
  });

  it('answers from storage when memory is holding another project', async () => {
    const repository = new InMemoryPersonSegmentationCacheRepository();
    const stored = resultOverOneWindow();
    await repository.store(PROJECT_ID, stored);
    const loadedStore = new LoadedPersonSegmentationCacheStore();
    loadedStore.publish('another-project', PersonSegmentationResult.nothingKnown(new MaskCache()));

    expect(await new PersonSegmentationResultReader(repository, loadedStore).read(PROJECT_ID)).toBe(stored);
  });

  it('says nothing is there when neither memory nor storage has one', async () => {
    const reader = new PersonSegmentationResultReader(
      new InMemoryPersonSegmentationCacheRepository(),
      new LoadedPersonSegmentationCacheStore(),
    );

    expect(await reader.read(PROJECT_ID)).toBeNull();
    expect(await reader.read(null)).toBeNull();
  });
});
