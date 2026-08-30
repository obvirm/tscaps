import type { Document, Section } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';

/**
 * The stretches of a video where a caption that could use the
 * text-behind-actor effect is on screen, as one normalised set of
 * ranges in source time.
 *
 * These are the only instants the effect can ever composite anything
 * at, on two counts: with no caption there is nothing to hide behind
 * the actor, and a caption painted with a template that does not ask
 * for the effect will not use it however the scene measures. Measuring
 * either would be measuring for no one.
 *
 * A section is painted with the sheet its `kind` names, so that is
 * where the template is read from. Nothing here is permanent: a sheet
 * that takes on the effect later turns its sections into stretches
 * that matter, and they show up as a gap in coverage like any other.
 *
 * The answer for a document and a set of sheets is kept until either
 * is replaced, because the question is asked once per playback tick
 * and walking every segment of every section at that rate is not free.
 * Both arrive as new values whenever they change, so identity is
 * enough to tell a stale answer from a current one.
 */
export class CaptionedRangeCollector {
  private lastDocument: Document | null = null;
  private lastSheets: ReadonlyArray<Sheet> | null = null;
  private lastRanges = TimeRangeSet.EMPTY;

  collect(document: Document | null, sheets: ReadonlyArray<Sheet>): TimeRangeSet {
    if (document === this.lastDocument && sheets === this.lastSheets) return this.lastRanges;
    this.lastDocument = document;
    this.lastSheets = sheets;
    this.lastRanges = this.rangesIn(document, sheets);
    return this.lastRanges;
  }

  private rangesIn(document: Document | null, sheets: ReadonlyArray<Sheet>): TimeRangeSet {
    if (document === null) return TimeRangeSet.EMPTY;
    const ranges = [];
    for (const section of document.sections) {
      if (!this.effectWantedIn(section, sheets)) continue;
      for (const segment of section.segments) {
        ranges.push({ start: segment.time.start, end: segment.time.end });
      }
    }
    return TimeRangeSet.of(ranges);
  }

  private effectWantedIn(section: Section, sheets: ReadonlyArray<Sheet>): boolean {
    return sheets.find((sheet) => sheet.id === section.kind)?.template.behindActor.required === true;
  }
}
