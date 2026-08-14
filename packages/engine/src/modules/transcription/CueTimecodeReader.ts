/** Half-open range a cue occupies, in seconds. */
export interface CueTimeRange {
  readonly startSeconds: number;
  readonly endSeconds: number;
}

/**
 * A position written `HH:MM:SS,mmm` or `HH:MM:SS.mmm`. SubRip settled
 * on the comma and WebVTT on the dot, and both are accepted either way
 * because files in the wild mix them. WebVTT also allows the hour to be
 * left out, so it is optional.
 */
const POSITION = String.raw`(?:(\d{1,3}):)?(\d{2}):(\d{2})[,.](\d{1,3})`;
const RANGE_LINE = new RegExp(`^${POSITION}\\s*-->\\s*${POSITION}`);
const POSITION_ONLY = new RegExp(`^${POSITION}$`);

/**
 * Reads the timecodes a caption file states its timings with.
 *
 * Positions are returned in seconds. A malformed timecode throws rather
 * than resolving to zero, so a file that cannot be trusted is refused
 * instead of silently landing every caption at the start.
 */
export class CueTimecodeReader {

  isRangeLine(line: string): boolean {
    return RANGE_LINE.test(line);
  }

  readRange(line: string): CueTimeRange {
    const match = RANGE_LINE.exec(line);
    if (match === null) throw new Error(`Malformed cue timecode: ${JSON.stringify(line)}`);
    const startSeconds = this.toSeconds(match[1], match[2]!, match[3]!, match[4]!);
    const endSeconds = this.toSeconds(match[5], match[6]!, match[7]!, match[8]!);
    if (endSeconds < startSeconds) {
      throw new Error(`Cue timecode ends before it starts: ${JSON.stringify(line)}`);
    }
    return { startSeconds, endSeconds };
  }

  readPosition(timecode: string): number {
    const match = POSITION_ONLY.exec(timecode);
    if (match === null) throw new Error(`Malformed timecode: ${JSON.stringify(timecode)}`);
    return this.toSeconds(match[1], match[2]!, match[3]!, match[4]!);
  }

  private toSeconds(
    hours: string | undefined,
    minutes: string,
    seconds: string,
    milliseconds: string,
  ): number {
    return (
      Number(hours ?? 0) * 3600 +
      Number(minutes) * 60 +
      Number(seconds) +
      Number(milliseconds.padEnd(3, '0')) / 1000
    );
  }
}
