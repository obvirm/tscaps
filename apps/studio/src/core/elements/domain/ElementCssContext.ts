/** What the checks need to know about the element the CSS is written against. */
export interface ElementCssContext {
  /** The variable an animation on this element should take its delay from. */
  readonly timingVariable: string;
}
