/**
 * How an element's own declarations reach the text that gets painted.
 *
 * An element that *is* the text styles it by declaring the property.
 * An element that wraps text cannot: the declarations that paint the
 * words sit on the words, and a declaration on a descendant beats
 * anything inherited from an ancestor whatever the layers say. Its
 * only way in is the custom property the template agreed to read.
 *
 * This is what a field needs to know about the element wearing it, and
 * the whole of it. A word and a decoration are the same surface; a
 * segment and a line are the other; a GIF would pick whichever it is.
 */
export type ElementStyleSurface = 'text' | 'wrapper';
