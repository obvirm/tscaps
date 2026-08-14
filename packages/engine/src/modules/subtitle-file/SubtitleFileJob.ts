import type { Document } from '@modules/document/Document';
import type { TimeRange } from '@modules/video/RenderTimeMap';
import type { SubtitleGranularity } from '@modules/subtitle-file/SubtitleGranularity';

/**
 * Everything a subtitle file is written from.
 *
 * `skipRanges` names the windows a render of the same document leaves
 * out, and must match the ones handed to the renderer. The file is
 * written on the timeline those exclusions produce, so both outputs
 * line up against the same footage; omit it when nothing is excluded.
 */
export interface SubtitleFileJob {
  readonly document: Document;
  readonly granularity: SubtitleGranularity;
  readonly skipRanges?: ReadonlyArray<TimeRange>;
}
