/**
 * A position on the timeline broken into the parts a subtitle timecode
 * is written from. Formats differ in separators, padding and precision,
 * so the decomposition is shared and the assembly is not.
 *
 * A position before the start of the timeline clamps to zero, and the
 * fractional part is rounded to whole milliseconds — finer detail than
 * any of these formats can hold.
 */
export class Timecode {
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly milliseconds: number;

  constructor(positionSeconds: number) {
    const totalMilliseconds = Math.round(Math.max(0, positionSeconds) * 1000);
    this.milliseconds = totalMilliseconds % 1000;
    const totalSeconds = (totalMilliseconds - this.milliseconds) / 1000;
    this.seconds = totalSeconds % 60;
    const totalMinutes = (totalSeconds - this.seconds) / 60;
    this.minutes = totalMinutes % 60;
    this.hours = (totalMinutes - this.minutes) / 60;
  }

  /** Hundredths of a second, for formats that stop at that precision. */
  centiseconds(): number {
    return Math.round(this.milliseconds / 10);
  }

  padded(value: number, width: number): string {
    return String(value).padStart(width, '0');
  }
}
