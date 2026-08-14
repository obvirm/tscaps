/**
 * The tones scenes cycle through, named as design tokens so each one
 * carries its own value per theme. Recolouring is editing `tokens.css`
 * alongside every other colour; lengthening the cycle is adding a token
 * there and its name here.
 */
const TONE_VARIABLES = [
  '--color-scene-1',
  '--color-scene-2',
  '--color-scene-3',
];

/**
 * The colour a scene is drawn with on the timeline, so neighbouring
 * scenes are told apart at a glance rather than by hunting for a seam.
 *
 * A short list of tones, cycled through. Telling a scene from the one
 * beside it is the whole job, so a scene needs no colour of its own;
 * what the tones have to be, and why, is written where they are
 * defined.
 *
 * One tone serves the scene at three strengths. The bar is a few pixels
 * tall and carries the reading, the wash goes behind the words where a
 * chip covers most of it, and the lit wash answers the pointer.
 *
 * **Retune the alphas whenever the tones change.** They are not a
 * matter of taste: each is set so its layer lands at the same measured
 * distance from the surface as the original palette did, and a quieter
 * tone has to cover more ground to say the same thing. Carrying alphas
 * across a palette change is how a wash ends up invisible or a hover
 * ends up shouting.
 *
 * The tones repeat, so a tone only ever separates a scene from the ones
 * drawn next to it. Which scenes those are — the ones touching it in
 * time and the ones stacked above it at the same instant — is not
 * something this class can see, so `toneIndex` arrives already settled
 * and is taken as given.
 */
export class TimelineScenePalette {

  constructor(
    private readonly barAlpha: number = 0.72,
    private readonly washAlpha: number = 0.14,
    private readonly litWashAlpha: number = 0.31,
  ) {}

  /** How many distinct tones the cycle holds. */
  get toneCount(): number {
    return TONE_VARIABLES.length;
  }

  /** The bar drawn under a scene's words. */
  barColorFor(toneIndex: number): string {
    return this.colorFor(toneIndex, this.barAlpha);
  }

  /** The tint drawn behind a scene's words. */
  washColorFor(toneIndex: number): string {
    return this.colorFor(toneIndex, this.washAlpha);
  }

  /** The same tint while the scene is under the pointer. */
  litWashColorFor(toneIndex: number): string {
    return this.colorFor(toneIndex, this.litWashAlpha);
  }

  private colorFor(toneIndex: number, alpha: number): string {
    const variable = TONE_VARIABLES[toneIndex % TONE_VARIABLES.length]!;
    return `rgb(var(${variable}) / ${alpha})`;
  }
}
