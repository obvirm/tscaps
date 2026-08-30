/**
 * One examined frame: the instant it was taken at, and whether it met
 * every scene-validity threshold.
 *
 * A sample is a property of the video at that instant, so it is never
 * invalidated by anything the user does to the captions — it is only
 * ever added to.
 */
export interface PassingSample {
  readonly t: number;
  readonly passes: boolean;
}
