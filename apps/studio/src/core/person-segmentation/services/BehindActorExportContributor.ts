import type { Document, TimeFragment } from '@tscaps/engine';
import { CssClass } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { BehindActorSegmentOverrideRegistry } from '@core/person-segmentation/domain/BehindActorSegmentOverrideRegistry';
import type {
  ExportRenderContext,
  ExportRenderContribution,
  ExportRenderContributor,
} from '@core/export/domain/ExportRenderContributor';
import type { BehindActorGatingService } from '@core/person-segmentation/services/BehindActorGatingService';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { EnsureSegmentMasksCachedAction } from '@core/person-segmentation/actions/EnsureSegmentMasksCachedAction';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import { ActorMaskTopLayerSource } from '@core/person-segmentation/infrastructure/ActorMaskTopLayerSource';

const EMPTY_CONTRIBUTION: ExportRenderContribution = {
  segmentClasses: new Map<string, ReadonlyArray<string>>(),
  topLayer: null,
};

/**
 * Contributes the text-behind-actor effect to an export: the
 * `behind-actor-active` class on every segment the effect is active
 * on, and the actor-cutout top layer for those segments' time ranges.
 * Before deciding anything it backfills mask gaps for force-on
 * segments (best-effort per segment; a failed backfill logs and the
 * export proceeds with whatever the cache holds).
 *
 * Contributes nothing when the project has no cached detector result:
 * without masks the effect cannot composite, and publishing the class
 * would move the caption without the occlusion that justifies the
 * move.
 */
export class BehindActorExportContributor implements ExportRenderContributor {

  constructor(
    private readonly gatingService: BehindActorGatingService,
    private readonly cacheRepository: PersonSegmentationCacheRepository,
    private readonly ensureSegmentMasks: EnsureSegmentMasksCachedAction,
  ) {}

  async prepare(context: ExportRenderContext): Promise<ExportRenderContribution> {
    let result = await this.loadResult(context.projectId);
    if (result !== null && await this.backfillForcedSegmentMasks(context.document, context.behindActorOverrides)) {
      result = await this.loadResult(context.projectId) ?? result;
    }
    if (result === null) return EMPTY_CONTRIBUTION;
    const activeSegmentIds = this.gatingService.buildActiveSegmentIds(
      context.document,
      result.windows,
      context.behindActorOverrides.all(),
      this.templateConfigBySectionKind(context.sheets),
    );
    return {
      segmentClasses: this.buildSegmentClasses(activeSegmentIds),
      topLayer: new ActorMaskTopLayerSource(result.maskCache, this.collectActiveRanges(context.document, activeSegmentIds)),
    };
  }

  private templateConfigBySectionKind(sheets: Sheet[]): ReadonlyMap<string, BehindActorTemplateConfig> {
    return new Map(sheets.map((sheet) => [sheet.id, sheet.template.behindActor]));
  }

  private buildSegmentClasses(activeSegmentIds: ReadonlySet<string>): ReadonlyMap<string, ReadonlyArray<string>> {
    const classes = new Map<string, ReadonlyArray<string>>();
    for (const segmentId of activeSegmentIds) classes.set(segmentId, [CssClass.BEHIND_ACTOR_ACTIVE]);
    return classes;
  }

  private collectActiveRanges(document: Document, activeSegmentIds: ReadonlySet<string>): TimeFragment[] {
    const ranges: TimeFragment[] = [];
    for (const section of document.sections) {
      for (const segment of section.segments) {
        if (activeSegmentIds.has(segment.id)) ranges.push(segment.time);
      }
    }
    return ranges;
  }

  private async loadResult(projectId: string | null): Promise<PersonSegmentationResult | null> {
    if (projectId === null) return null;
    try {
      return await this.cacheRepository.load(projectId);
    } catch (error) {
      console.error('[behind-actor] failed to load person-segmentation cache for export', error);
      return null;
    }
  }

  /**
   * Fills mask gaps for every force-on segment before the render
   * starts — a forced segment outside the detector's windows has no
   * masks from the initial scan (or lost them to a re-scan on another
   * device). Returns whether any backfill ran, so the cached result
   * can be reloaded with the merged masks.
   */
  private async backfillForcedSegmentMasks(doc: Document, behindActorOverrides: BehindActorSegmentOverrideRegistry): Promise<boolean> {
    let anyRan = false;
    for (const section of doc.sections) {
      for (const segment of section.segments) {
        if (behindActorOverrides.get(segment.id) !== 'force-on') continue;
        try {
          await this.ensureSegmentMasks.execute({
            segmentId: segment.id,
            range: { start: segment.time.start, end: segment.time.end },
          });
          anyRan = true;
        } catch (error) {
          console.error('[behind-actor] failed to backfill masks for forced segment', segment.id, error);
        }
      }
    }
    return anyRan;
  }
}
