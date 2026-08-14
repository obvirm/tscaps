/**
 * What kind of document node an addressable element is.
 *
 * Carried alongside anything keyed by element id, because an id on its
 * own says nothing about what it points at and the answer changes
 * behaviour: a reflow dissolves a segment's identity, so work attached
 * to a segment has to exclude it. Words survive — the derivation
 * regroups them, it never recreates them.
 */
export const ELEMENT_KINDS = ['segment', 'line', 'word', 'decoration'] as const;

export type ElementKind = typeof ELEMENT_KINDS[number];
