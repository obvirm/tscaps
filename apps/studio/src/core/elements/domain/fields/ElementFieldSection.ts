/**
 * Which part of an element's look a field belongs to.
 *
 * Declared by the field rather than by the kind of element wearing it,
 * for the same reason its bounds are: a field means one thing wherever
 * it appears, so a word and a GIF cannot end up filing the same field
 * under two headings. A new kind picks the fields it needs and the
 * panel organises itself.
 */
export enum ElementFieldSection {
  /** What the text reads like. */
  TEXT = 'text',
  /** How big it is, which way it is turned, and where it sits. */
  LAYOUT = 'layout',
}
