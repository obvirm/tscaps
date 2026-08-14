import type { AlignmentConfig } from '@modules/rendering/types/AlignmentConfig';
import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';

/**
 * Render-time overrides for one element (segment or word), layered on
 * top of the style's root-level defaults. The fields are independent
 * and optional; an entry where all are absent is equivalent to the
 * absence of the entry and should be omitted by builders.
 *
 * `inlineStyles` lands on the element's `style="..."` attribute (CSS
 * custom properties and direct properties coexist transparently);
 * `alignment` is partial and merges over the style's root alignment to
 * yield the element's effective anchor point and box-edge selection;
 * `classes` are appended to the element's class list, so stylesheets
 * can select on consumer-driven state. Segment-scope classes apply to
 * the main segment subtree only — positioned sibling subtrees (a word
 * pinned at its own anchor) hold their exact spot and must not pick
 * up state-driven styling.
 */
export interface ScopedRenderOverride {
  readonly inlineStyles?: InlineStyleMap;
  readonly alignment?: Partial<AlignmentConfig>;
  readonly classes?: ReadonlyArray<string>;
}
