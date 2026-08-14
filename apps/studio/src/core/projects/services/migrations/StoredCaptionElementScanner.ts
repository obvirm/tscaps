import type { ElementKind } from '@core/elements/domain/ElementKind';

/** One element of a stored document that could have been styled. */
export interface StoredCaptionElement {
  readonly id: string;
  readonly kind: ElementKind;
  /** The sheet whose rules the element rendered under. */
  readonly sheetId: string;
  /**
   * The size, in `cqh`, that the text around this element is set at.
   *
   * What a size stored against the element has to be read against when
   * it is turned into a ratio: the element rendered at its own number
   * while its surroundings rendered at this one.
   */
  readonly surroundingFontSize: number;
}

const DEFAULT_FONT_SIZE_CQH = 8;

/**
 * Walks a stored document and reports every element that could carry a
 * style, in the order they appear.
 *
 * Reads the payload rather than the domain, so it works on the shape a
 * project was saved in rather than the one the app has moved on to.
 * Nothing here builds engine objects: a document that no longer
 * deserializes is exactly the one whose styles still have to be
 * carried forward.
 */
export class StoredCaptionElementScanner {
  scan(data: Record<string, unknown>): ReadonlyArray<StoredCaptionElement> {
    const sheetFontSizes = this.readSheetFontSizes(data);
    const segmentFontSizes = this.readSegmentFontSizes(data);
    const wordFontSizes = this.readWordFontSizes(data);

    const found: StoredCaptionElement[] = [];
    for (const section of this.arrayAt(data.document, 'sections')) {
      const sheetId = this.textAt(section, 'kind') ?? '';
      const sheetFontSize = sheetFontSizes.get(sheetId) ?? DEFAULT_FONT_SIZE_CQH;
      for (const segment of this.arrayAt(section, 'segments')) {
        const segmentId = this.textAt(segment, 'id');
        if (segmentId === null) continue;
        const segmentFontSize = segmentFontSizes.get(segmentId) ?? sheetFontSize;
        found.push({ id: segmentId, kind: 'segment', sheetId, surroundingFontSize: sheetFontSize });
        this.scanSegment(segment, sheetId, segmentFontSize, wordFontSizes, found);
      }
    }
    return found;
  }

  private scanSegment(
    segment: unknown,
    sheetId: string,
    segmentFontSize: number,
    wordFontSizes: ReadonlyMap<string, number>,
    found: StoredCaptionElement[],
  ): void {
    for (const line of this.arrayAt(segment, 'lines')) {
      for (const word of this.arrayAt(line, 'words')) {
        const wordId = this.textAt(word, 'id');
        if (wordId === null) continue;
        found.push({ id: wordId, kind: 'word', sheetId, surroundingFontSize: segmentFontSize });
        const decorationId = this.textAt(this.recordAt(word, 'decoration'), 'id');
        if (decorationId === null) continue;
        found.push({
          id: decorationId,
          kind: 'decoration',
          sheetId,
          surroundingFontSize: wordFontSizes.get(wordId) ?? segmentFontSize,
        });
      }
    }
  }

  private readSheetFontSizes(data: Record<string, unknown>): ReadonlyMap<string, number> {
    const sizes = new Map<string, number>();
    for (const sheet of this.arrayAt(data, 'sheets')) {
      const id = this.textAt(sheet, 'id');
      const fontSize = this.numberAt(this.recordAt(sheet, 'typographyConfig'), 'fontSize');
      if (id !== null && fontSize !== null) sizes.set(id, fontSize);
    }
    return sizes;
  }

  private readSegmentFontSizes(data: Record<string, unknown>): ReadonlyMap<string, number> {
    return this.fontSizesIn(this.recordAt(this.recordAt(data, 'segmentOverrides'), 'style'));
  }

  private readWordFontSizes(data: Record<string, unknown>): ReadonlyMap<string, number> {
    return this.fontSizesIn(this.recordAt(data, 'wordStyleOverrides'));
  }

  private fontSizesIn(overrides: Record<string, unknown> | null): ReadonlyMap<string, number> {
    const sizes = new Map<string, number>();
    if (!overrides) return sizes;
    for (const id of Object.keys(overrides)) {
      const fontSize = this.numberAt(this.recordAt(overrides, id), 'fontSize');
      if (fontSize !== null) sizes.set(id, fontSize);
    }
    return sizes;
  }

  private arrayAt(value: unknown, key: string): ReadonlyArray<unknown> {
    if (typeof value !== 'object' || value === null) return [];
    const held = (value as Record<string, unknown>)[key];
    return Array.isArray(held) ? held : [];
  }

  private recordAt(value: unknown, key: string): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null) return null;
    const held = (value as Record<string, unknown>)[key];
    if (typeof held !== 'object' || held === null || Array.isArray(held)) return null;
    return held as Record<string, unknown>;
  }

  private textAt(value: unknown, key: string): string | null {
    if (typeof value !== 'object' || value === null) return null;
    const held = (value as Record<string, unknown>)[key];
    return typeof held === 'string' ? held : null;
  }

  private numberAt(value: unknown, key: string): number | null {
    if (typeof value !== 'object' || value === null) return null;
    const held = (value as Record<string, unknown>)[key];
    return typeof held === 'number' && Number.isFinite(held) ? held : null;
  }
}
