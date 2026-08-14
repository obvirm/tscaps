/**
 * What sits inside one addressable element.
 *
 * Asked here and answered elsewhere: which elements a caption document
 * holds is the other side of this module's boundary, and a field that
 * has to stop being answered further in needs nothing but the ids.
 */
export interface ElementDescendantResolver {
  /**
   * Every element inside this one, however deep. Empty for an element
   * that holds nothing, and for one nothing on screen answers to.
   */
  descendantsOf(elementId: string): ReadonlySet<string>;
}
