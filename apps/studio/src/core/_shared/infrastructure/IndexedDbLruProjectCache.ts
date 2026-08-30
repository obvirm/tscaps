import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';

/**
 * The two fields this cache writes on every record: the project the
 * entry belongs to, and when it was last read. Owners add their own
 * payload on top and never write either of them.
 */
export interface ProjectCacheEntry {
  readonly projectId: string;
  readonly lastAccessed: number;
}

/**
 * One IndexedDB object store holding at most `maxCachedProjects`
 * entries, one per project, evicted least-recently-read first. The
 * store it is given must declare `projectId` as its key path.
 *
 * Owners keep the entry shape and the mapping to their own domain;
 * residency is this class's business — stamping the access time,
 * choosing the victim, and evicting before a write that would take
 * the store past the cap.
 *
 * A read survives an origin with no room left. A write does not. See
 * {@link read} and {@link write}.
 */
export class IndexedDbLruProjectCache<TEntry extends ProjectCacheEntry> {
  constructor(
    private readonly db: IndexedDbClient,
    private readonly storeName: string,
    private readonly maxCachedProjects: number,
  ) {}

  /**
   * Reads the entry held for `projectId`, or `null` when there is
   * none. Moves it to the back of the eviction queue, and resolves
   * whether or not that bookkeeping write goes through, so a device
   * with no room left still hands back what it holds.
   */
  async read(projectId: string): Promise<TEntry | null> {
    const entry = await this.db.readOne<TEntry>(this.storeName, projectId);
    if (!entry) return null;
    await this.touch(entry);
    return entry;
  }

  /**
   * Writes `payload` as the entry of `projectId`, stamped as the most
   * recently read, evicting the least recent entry first when the
   * cache is already at the cap. Replacing the entry a project
   * already has is not growth, so refreshing one project's entry
   * never evicts another's.
   *
   * Raises whatever the database raised — an entry that did not reach
   * disk is a fact its owner has to act on, unlike the access time
   * below.
   */
  async write(projectId: string, payload: Omit<TEntry, keyof ProjectCacheEntry>): Promise<void> {
    await this.evictIfNeeded(projectId);
    await this.db.writeOne(this.storeName, { ...payload, projectId, lastAccessed: Date.now() });
  }

  async delete(projectId: string): Promise<void> {
    await this.db.deleteOne(this.storeName, projectId);
  }

  /**
   * Refreshing the eviction order is bookkeeping about a read, not
   * part of one, and it is still a write: an origin with nothing left
   * to give refuses it like any other. Raising here would stop a
   * project whose bytes were just read intact from opening at all,
   * while a stale timestamp costs no more than a worse choice of
   * victim the next time something has to be evicted.
   */
  private async touch(entry: TEntry): Promise<void> {
    try {
      await this.db.writeOne(this.storeName, { ...entry, lastAccessed: Date.now() });
    } catch { /* the eviction order is worth less than the read it would fail */ }
  }

  private async evictIfNeeded(incomingId: string): Promise<void> {
    const all = await this.db.readAll<TEntry>(this.storeName);
    const isReplacement = all.some((entry) => entry.projectId === incomingId);
    const projectedSize = isReplacement ? all.length : all.length + 1;
    if (projectedSize <= this.maxCachedProjects) return;
    const victim = this.pickEvictionVictim(all, incomingId);
    if (victim) await this.delete(victim.projectId);
  }

  private pickEvictionVictim(all: TEntry[], incomingId: string): TEntry | null {
    const candidates = all
      .filter((entry) => entry.projectId !== incomingId)
      .sort((a, b) => a.lastAccessed - b.lastAccessed);
    return candidates[0] ?? null;
  }
}
