/** Plain shape for serialization: the ids nothing else records. */
export type FrozenSegmentSetSnapshot = ReadonlyArray<string>;

/**
 * Which segments are excluded from reflow, and for what reason.
 *
 * The reason is part of the state because it decides when the exclusion
 * is lifted: a segment excluded only for carrying a style of its own
 * has to start reflowing again the moment that style is cleared, while
 * one the user split or retyped stays put until the layout is reset
 * outright. A set that forgot why an id was added could only ever grow.
 *
 * The two reasons are held apart because they are remembered
 * differently. A structural edit leaves no trace anywhere else, so this
 * is where it is kept and the only thing that drops it is a reset —
 * which is also the only part that gets serialized. A style is already
 * recorded by the store that owns it, so what is held here is a mirror,
 * handed in whenever it changes.
 *
 * Immutable, so a history entry that captured it keeps what it
 * captured. Every method returns `this` when nothing would change.
 */
export class FrozenSegmentSet {
  static empty(): FrozenSegmentSet {
    return new FrozenSegmentSet(new Set(), new Set());
  }

  static fromSnapshot(snapshot: FrozenSegmentSetSnapshot): FrozenSegmentSet {
    return new FrozenSegmentSet(new Set(snapshot), new Set());
  }

  private constructor(
    private readonly _structurallyEdited: ReadonlySet<string>,
    private readonly _styled: ReadonlySet<string>,
  ) {}

  has(segmentId: string): boolean {
    return this._structurallyEdited.has(segmentId) || this._styled.has(segmentId);
  }

  /** Records that the user split, merged, inserted or retyped these segments. */
  withStructurallyEdited(segmentIds: Iterable<string>): FrozenSegmentSet {
    let next: Set<string> | null = null;
    for (const id of segmentIds) {
      if (this._structurallyEdited.has(id)) continue;
      next ??= new Set(this._structurallyEdited);
      next.add(id);
    }
    return next ? new FrozenSegmentSet(next, this._styled) : this;
  }

  /**
   * Forgets that these segments were edited by hand. One that also
   * carries a style stays excluded, for that reason.
   */
  withoutStructurallyEdited(segmentIds: Iterable<string>): FrozenSegmentSet {
    let next: Set<string> | null = null;
    for (const id of segmentIds) {
      if (!this._structurallyEdited.has(id)) continue;
      next ??= new Set(this._structurallyEdited);
      next.delete(id);
    }
    return next ? new FrozenSegmentSet(next, this._styled) : this;
  }

  /**
   * Takes `segmentIds` as the complete set of segments that currently
   * carry a style, so segments that lost theirs stop being excluded for
   * that reason. Returns `this` when the same segments are styled as
   * before — restyling one that was already styled leaves every
   * exclusion where it was, and consumers watching this value should
   * not be woken up for it.
   */
  replacingStyled(segmentIds: ReadonlySet<string>): FrozenSegmentSet {
    if (this.sameMembers(segmentIds, this._styled)) return this;
    return new FrozenSegmentSet(this._structurallyEdited, segmentIds);
  }

  toSnapshot(): FrozenSegmentSetSnapshot {
    return [...this._structurallyEdited];
  }

  private sameMembers(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
    if (a.size !== b.size) return false;
    for (const id of a) {
      if (!b.has(id)) return false;
    }
    return true;
  }
}
