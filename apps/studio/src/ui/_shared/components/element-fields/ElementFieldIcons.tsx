import type { ReactNode } from 'react';
import { Italic, Underline, Strikethrough } from 'lucide-react';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';

const ICONS: Partial<Readonly<Record<ElementFieldId, ReactNode>>> = {
  [ElementFieldId.ITALIC]: <Italic size={13} />,
  [ElementFieldId.UNDERLINE]: <Underline size={13} />,
  [ElementFieldId.STRIKETHROUGH]: <Strikethrough size={13} />,
};

/**
 * The picture a field goes by when it is small enough to need no label,
 * or `null` for one that reads as a labelled row instead.
 *
 * Whether a field has one is a presentation choice, so it is answered
 * here rather than declared beside its bounds. A field with no icon is
 * simply drawn the ordinary way.
 */
export function elementFieldIcon(controlId: string): ReactNode | null {
  return ICONS[controlId as ElementFieldId] ?? null;
}
