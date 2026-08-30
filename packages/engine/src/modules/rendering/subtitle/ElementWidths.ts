import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';

/**
 * How wide each element of one rendered caption came out, as a
 * multiple of the font size that element renders at.
 *
 * The multiple is what makes the answer usable: a stylesheet deriving a
 * font size from a width cannot be told the width in pixels, because
 * the pixels it would be told are the ones its own answer produces. A
 * width in `em` is free of that, so it stays true whatever size the
 * measurement happened to be taken at.
 */
export class ElementWidths {

  constructor(private readonly widthEmByElementId: ReadonlyMap<string, number>) {}

  static empty(): ElementWidths {
    return new ElementWidths(new Map());
  }

  /**
   * The named custom property carrying `elementId`'s width, or nothing
   * at all when the element was not measured — so a caller can spread
   * the result unconditionally.
   */
  varsFor(property: string, elementId: string): InlineStyleMap {
    const widthEm = this.widthEmByElementId.get(elementId);
    return widthEm === undefined ? {} : { [property]: String(widthEm) };
  }
}
