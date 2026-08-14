/**
 * A value a stylesheet gave one of an animation's custom properties, as
 * it was written.
 *
 * A number keeps its amount apart from its unit, so a field over it is
 * arithmetic rather than a reading of text — the direction of a signed
 * value is its sign, and the distance is its absolute value.
 *
 * Anything that is not a literal stays whole and stays `text`: a
 * template routing a duration through a variable of its own has no
 * number underneath for a dial to start on, and saying so is better
 * than guessing one.
 */
export type AnimationValue =
  | { readonly kind: 'number'; readonly amount: number; readonly unit: string }
  | { readonly kind: 'text'; readonly text: string };
