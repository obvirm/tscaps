import type { BehindActorSegmentOverride } from '@core/person-segmentation/domain/BehindActorSegmentOverride';

/** Plain shape for serialization. Keys are `Segment.id`; only segments the user answered for are present. */
export type BehindActorSegmentOverridesSnapshot = Readonly<Record<string, BehindActorSegmentOverride>>;

/**
 * The segments where the user has overruled whether the caption hides
 * behind the actor, keyed by segment id.
 *
 * An override in the same sense a style override is one: the sheet's
 * template decides this, and an entry here takes that decision away
 * from it for one segment. Absence means the template still decides.
 *
 * Its own store rather than a part of how a segment is styled, because
 * the lifecycles differ: resetting a scene's layout drops what the user
 * shaped and deliberately leaves this standing, and unlike a style it
 * is not one of the reasons a segment is excluded from reflow.
 *
 * Immutable. Every mutator returns a new instance, and `'auto'` clears
 * the entry — absence and `'auto'` are the same state.
 */
export class BehindActorSegmentOverrideRegistry {
  static empty(): BehindActorSegmentOverrideRegistry {
    return new BehindActorSegmentOverrideRegistry(new Map());
  }

  static fromSnapshot(snapshot: BehindActorSegmentOverridesSnapshot): BehindActorSegmentOverrideRegistry {
    return new BehindActorSegmentOverrideRegistry(new Map(Object.entries(snapshot)));
  }

  private constructor(private readonly entries: ReadonlyMap<string, BehindActorSegmentOverride>) {}

  get(segmentId: string): BehindActorSegmentOverride {
    return this.entries.get(segmentId) ?? 'auto';
  }

  all(): ReadonlyMap<string, BehindActorSegmentOverride> {
    return this.entries;
  }

  isEmpty(): boolean {
    return this.entries.size === 0;
  }

  with(segmentId: string, override: BehindActorSegmentOverride): BehindActorSegmentOverrideRegistry {
    if (this.get(segmentId) === override) return this;
    const next = new Map(this.entries);
    if (override === 'auto') next.delete(segmentId);
    else next.set(segmentId, override);
    return new BehindActorSegmentOverrideRegistry(next);
  }

  without(segmentIds: Iterable<string>): BehindActorSegmentOverrideRegistry {
    let next: Map<string, BehindActorSegmentOverride> | null = null;
    for (const id of segmentIds) {
      if (!this.entries.has(id)) continue;
      next ??= new Map(this.entries);
      next.delete(id);
    }
    return next ? new BehindActorSegmentOverrideRegistry(next) : this;
  }

  toSnapshot(): BehindActorSegmentOverridesSnapshot {
    return Object.fromEntries(this.entries);
  }
}
