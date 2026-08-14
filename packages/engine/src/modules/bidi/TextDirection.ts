/**
 * Base direction a stretch of text is laid out against. It is the
 * paragraph embedding level the Unicode bidirectional algorithm starts
 * from: `ltr` is level 0, `rtl` is level 1. Every level the algorithm
 * resolves is relative to it, so the same text under a different base
 * paints in a different order.
 */
export type TextDirection = 'ltr' | 'rtl';
