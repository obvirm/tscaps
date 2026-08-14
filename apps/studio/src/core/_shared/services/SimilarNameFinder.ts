/**
 * Picks the candidates closest to a name that was not found, so an
 * error can suggest what the author probably meant instead of listing
 * a whole vocabulary back at them.
 *
 * Distance is Levenshtein, with a tolerance that grows slowly with the
 * length of the name: a typo in a long id survives more edits than one
 * in a short id, but a name that merely shares a prefix is not a typo
 * of it. Candidates beyond the tolerance are dropped rather than
 * ranked, so a name with no plausible match yields nothing and the
 * caller can say so plainly instead of guessing.
 */
export class SimilarNameFinder {
  constructor(private readonly maxSuggestions: number = 2) {}

  closestTo(name: string, candidates: Iterable<string>): readonly string[] {
    const tolerance = Math.max(2, Math.floor(name.length / 4));
    return [...candidates]
      .map((candidate) => ({ candidate, distance: this.editDistance(name, candidate) }))
      .filter((match) => match.distance <= tolerance)
      .sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate))
      .slice(0, this.maxSuggestions)
      .map((match) => match.candidate);
  }

  private editDistance(from: string, to: string): number {
    let previousRow = Array.from({ length: to.length + 1 }, (_unused, index) => index);
    for (let i = 1; i <= from.length; i++) {
      const row = [i];
      for (let j = 1; j <= to.length; j++) {
        const substitution = previousRow[j - 1]! + (from[i - 1] === to[j - 1] ? 0 : 1);
        row[j] = Math.min(row[j - 1]! + 1, previousRow[j]! + 1, substitution);
      }
      previousRow = row;
    }
    return previousRow[to.length]!;
  }
}
