import { DataAttribute } from '@tscaps/engine';

/**
 * The attribute that makes a rendered node addressable by a
 * per-element stylesheet rule, re-published for the React overlay.
 *
 * The overlay and the export are two different producers of the same
 * caption DOM against one stylesheet contract, so the name has to come
 * from the framework rather than be spelled again here — a fragment
 * that matched in one and not the other would render in the preview
 * and vanish from the export.
 *
 * Unlike the export, the overlay stamps it on every element it paints:
 * the cost the export is avoiding is per-tile serialization, and the
 * live DOM is built once.
 */
export const CAPTION_ELEMENT_ID_ATTRIBUTE: string = DataAttribute.ELEMENT_ID;
