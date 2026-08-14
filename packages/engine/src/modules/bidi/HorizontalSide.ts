/**
 * A side named by where reading begins and ends rather than by where it
 * lands on screen. `start` is the left edge of left-to-right text and the
 * right edge of right-to-left text.
 */
export type ReadingSide = 'start' | 'center' | 'end';

/** A side of the screen, which stays where it is in either direction. */
export type PhysicalSide = 'left' | 'center' | 'right';

/** Every screen side, for reading one back off something that was stored. */
export const PHYSICAL_SIDES: ReadonlyArray<PhysicalSide> = ['left', 'center', 'right'];

/**
 * Either vocabulary, the way `text-align` accepts both. A layout value takes
 * this type when the choice between them belongs to the author: naming a
 * screen side pins the value to the frame, naming a reading side lets it
 * follow the language of the text.
 */
export type HorizontalSide = PhysicalSide | ReadingSide;
