import type { Document, TimeFragment } from '@tscaps/engine';
import { CssClass } from '@tscaps/engine';
import type { BehindActorGatingService } from '@core/person-segmentation/services/BehindActorGatingService';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { ExportRenderContext, ExportRenderContribution } from '@core/export/domain/ExportRenderContributor';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import { ActorMaskTopLayerSource } from '@core/person-segmentation/infrastructure/ActorMaskTopLayerSource';

/**
 * Turns one detector result into what the render needs from the
 * text-behind-actor effect: the activation class on every segment the
 * effect is on, and the actor cutout over those segments' time ranges.
 *
 * Holds no opinion on where the result came from, so a host that
 * measured the video itself and a host that was handed the measurement
 * reach the same picture from the same record. That is the whole point
 * of it being one class: two ways of deciding would be two answers.
 */
export class BehindActorContributionBuilder {

  /** Nothing on any segment and nothing painted over the captions. */
  static readonly NOTHING: ExportRenderContribution = {
    segmentClasses: new Map<string, ReadonlyArray<string>>(),
    topLayer: null,
  };

  constructor(private readonly gatingService: BehindActorGatingService) {}

  /**
   * Contributes nothing for a `null` result: without masks the effect
   * cannot composite, and publishing the class alone would move the
   * caption without the occlusion that justifies the move.
   */
  build(context: ExportRenderContext, result: PersonSegmentationResult | null): ExportRenderContribution {
    if (result === null) return BehindActorContributionBuilder.NOTHING;
    const activeSegmentIds = this.gatingService.buildActiveSegmentIds(
      context.document,
      result.windows,
      context.behindActorOverrides.all(),
      this.templateConfigBySectionKind(context),
    );
    return {
      segmentClasses: this.buildSegmentClasses(activeSegmentIds),
      topLayer: new ActorMaskTopLayerSource(
        result.maskCache,
        this.collectActiveRanges(context.document, activeSegmentIds),
      ),
    };
  }

  private templateConfigBySectionKind(context: ExportRenderContext): ReadonlyMap<string, BehindActorTemplateConfig> {
    return new Map(context.sheets.map((sheet) => [sheet.id, sheet.template.behindActor]));
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
}
