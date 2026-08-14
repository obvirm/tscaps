import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { StoredCaptionElement } from '@core/projects/services/migrations/StoredCaptionElementScanner';

const WHOLE_RATIO = 100;

/**
 * Reads the typography an element was stored with, as the values its
 * fields hold today.
 *
 * Only the shapes differ, not the look: a switch that was a boolean is
 * the CSS keyword it always produced, and a size that named a share of
 * the frame becomes the ratio to its surroundings that renders at the
 * same place. That ratio is exact — a template that grows or shrinks
 * the caption scales the element and its surroundings together, so it
 * cancels out of the division.
 *
 * A value the field cannot hold is dropped rather than guessed at.
 */
export class StoredTypographyReader {
  read(element: StoredCaptionElement, stored: Record<string, unknown>): ReadonlyMap<ElementFieldId, ElementControlValue> {
    const values = new Map<ElementFieldId, ElementControlValue>();
    this.addKeyword(values, ElementFieldId.ITALIC, stored.italic, 'italic', 'normal');
    this.addKeyword(values, ElementFieldId.UNDERLINE, stored.underline, 'underline', 'none');
    this.addKeyword(values, ElementFieldId.STRIKETHROUGH, stored.strikethrough, 'line-through', 'none');
    this.addText(values, ElementFieldId.FONT_FAMILY, stored.fontFamily);
    this.addText(values, ElementFieldId.PRIMARY_COLOR, stored.color);
    this.addNumber(values, ElementFieldId.FONT_WEIGHT, stored.fontWeight);
    this.addNumber(values, ElementFieldId.ROTATION, stored.rotation);
    this.addSize(values, element, stored.fontSize);
    return values;
  }

  private addSize(
    values: Map<ElementFieldId, ElementControlValue>,
    element: StoredCaptionElement,
    stored: unknown,
  ): void {
    if (typeof stored !== 'number' || !Number.isFinite(stored)) return;
    if (element.kind === 'segment' || element.kind === 'line') {
      values.set(ElementFieldId.FONT_SIZE, stored);
      return;
    }
    if (element.surroundingFontSize <= 0) return;
    values.set(ElementFieldId.RELATIVE_SIZE, (stored / element.surroundingFontSize) * WHOLE_RATIO);
  }

  private addKeyword(
    values: Map<ElementFieldId, ElementControlValue>,
    fieldId: ElementFieldId,
    stored: unknown,
    whenOn: string,
    whenOff: string,
  ): void {
    if (typeof stored !== 'boolean') return;
    values.set(fieldId, stored ? whenOn : whenOff);
  }

  private addText(values: Map<ElementFieldId, ElementControlValue>, fieldId: ElementFieldId, stored: unknown): void {
    if (typeof stored !== 'string' || stored.length === 0) return;
    values.set(fieldId, stored);
  }

  private addNumber(values: Map<ElementFieldId, ElementControlValue>, fieldId: ElementFieldId, stored: unknown): void {
    if (typeof stored !== 'number' || !Number.isFinite(stored)) return;
    values.set(fieldId, stored);
  }
}
