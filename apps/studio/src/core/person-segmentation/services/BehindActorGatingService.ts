import type { Document, Segment } from '@tscaps/engine';
import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';
import type { BehindActorSegmentOverride } from '@core/person-segmentation/domain/BehindActorSegmentOverride';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import { BEHIND_ACTOR_TEMPLATE_CONFIG_DEFAULT } from '@core/person-segmentation/domain/BehindActorTemplateConfig';

/**
 * The single decision point for whether the text-behind-actor effect
 * is active on a segment. Combines four inputs: the user's per-segment
 * override, the section's template config (opt-in flag + tag
 * condition), the detector's valid windows, and the segment itself.
 *
 * `force-on` is always active and `force-off` never is, regardless of
 * the template. On `auto`, a segment is active only when its template
 * opts in, the segment qualifies under the template's tag condition
 * (evaluated against the union of the segment's tags; a `null`
 * condition qualifies every segment), and its entire time range fits
 * inside a single detector window — a segment straddling a window
 * boundary would flicker in and out of the effect mid-playback, so it
 * is treated as inactive.
 */
export class BehindActorGatingService {

  /**
   * Ids of the segments the effect is active on, across the whole
   * document. `templateConfigBySectionKind` maps each section kind to
   * its template's config; sections without an entry never activate
   * on `auto`.
   */
  buildActiveSegmentIds(
    document: Document,
    validWindows: ReadonlyArray<PersonSegmentationWindow>,
    overrides: ReadonlyMap<string, BehindActorSegmentOverride>,
    templateConfigBySectionKind: ReadonlyMap<string, BehindActorTemplateConfig>,
  ): ReadonlySet<string> {
    const activeIds = new Set<string>();
    for (const section of document.sections) {
      const templateConfig = templateConfigBySectionKind.get(section.kind) ?? BEHIND_ACTOR_TEMPLATE_CONFIG_DEFAULT;
      for (const segment of section.segments) {
        if (this.isEffectivelyOn(segment, overrides.get(segment.id) ?? 'auto', validWindows, templateConfig)) {
          activeIds.add(segment.id);
        }
      }
    }
    return activeIds;
  }

  isEffectivelyOn(
    segment: Segment,
    override: BehindActorSegmentOverride,
    validWindows: ReadonlyArray<PersonSegmentationWindow>,
    templateConfig: BehindActorTemplateConfig,
  ): boolean {
    if (override === 'force-on') return true;
    if (override === 'force-off') return false;
    return templateConfig.required
      && this.matchesTagCondition(segment, templateConfig)
      && this.isSegmentFullyContainedInAnyWindow(segment, validWindows);
  }

  private matchesTagCondition(segment: Segment, templateConfig: BehindActorTemplateConfig): boolean {
    if (templateConfig.tagCondition === null) return true;
    return templateConfig.tagCondition.evaluate(segment.getAllTags());
  }

  private isSegmentFullyContainedInAnyWindow(
    segment: Segment,
    windows: ReadonlyArray<PersonSegmentationWindow>,
  ): boolean {
    for (const window of windows) {
      if (window.start <= segment.time.start && segment.time.end <= window.end) return true;
    }
    return false;
  }
}
