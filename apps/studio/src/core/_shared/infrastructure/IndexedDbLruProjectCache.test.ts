import { describe, expect, it } from 'vitest';
import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import {
  IndexedDbLruProjectCache,
  type ProjectCacheEntry,
} from '@core/_shared/infrastructure/IndexedDbLruProjectCache';

/**
 * These cover the two promises the cache makes to whoever keeps a
 * per-project entry in it: what comes back out, and which project
 * loses its entry when the cap is reached. The entry shape below
 * stands in for a video blob, a preview proxy, or a mask cache — the
 * cache treats all three the same way.
 */

const STORE = 'entries';

interface TestEntry extends ProjectCacheEntry {
  readonly payload: string;
}

/**
 * In-memory stand-in for the database. `refuseWrites` reproduces an
 * origin with no room left: every write raises, exactly as IndexedDB
 * does once the quota is reached, while reads keep working.
 */
class FakeIndexedDbClient {
  private readonly records = new Map<string, TestEntry>();

  refuseWrites = false;

  seed(record: TestEntry): void {
    this.records.set(record.projectId, record);
  }

  keys(): string[] {
    return [...this.records.keys()];
  }

  readOne<T>(_storeName: string, key: IDBValidKey): Promise<T | null> {
    return Promise.resolve((this.records.get(String(key)) as T | undefined) ?? null);
  }

  readAll<T>(_storeName: string): Promise<T[]> {
    return Promise.resolve([...this.records.values()] as T[]);
  }

  writeOne(_storeName: string, value: object): Promise<void> {
    if (this.refuseWrites) {
      return Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError'));
    }
    const record = value as TestEntry;
    this.records.set(record.projectId, record);
    return Promise.resolve();
  }

  deleteOne(_storeName: string, key: IDBValidKey): Promise<void> {
    this.records.delete(String(key));
    return Promise.resolve();
  }
}

describe('IndexedDbLruProjectCache', () => {
  const substitute = <T>(stub: object): T => stub as T;

  const buildCache = (db: FakeIndexedDbClient, maxCachedProjects = 3) =>
    new IndexedDbLruProjectCache<TestEntry>(substitute<IndexedDbClient>(db), STORE, maxCachedProjects);

  it('reads the entry back when the origin has no room left to record the read', async () => {
    const db = new FakeIndexedDbClient();
    db.seed({ projectId: 'a', payload: 'bytes', lastAccessed: 1 });
    db.refuseWrites = true;

    const record = await buildCache(db).read('a');

    expect(record?.payload).toBe('bytes');
  });

  it('resolves to null for a project it holds nothing for', async () => {
    const db = new FakeIndexedDbClient();

    expect(await buildCache(db).read('missing')).toBeNull();
  });

  it('evicts the entry whose access time is the oldest', async () => {
    const db = new FakeIndexedDbClient();
    db.seed({ projectId: 'old', payload: 'old', lastAccessed: 1 });
    db.seed({ projectId: 'recent', payload: 'recent', lastAccessed: 2 });

    await buildCache(db, 2).write('incoming', { payload: 'incoming' });

    expect(db.keys().sort()).toEqual(['incoming', 'recent']);
  });

  it('spares the oldest entry once it has been read again', async () => {
    const db = new FakeIndexedDbClient();
    db.seed({ projectId: 'old', payload: 'old', lastAccessed: 1 });
    db.seed({ projectId: 'recent', payload: 'recent', lastAccessed: 2 });
    const store = buildCache(db, 2);

    await store.read('old');
    await store.write('incoming', { payload: 'incoming' });

    expect(db.keys().sort()).toEqual(['incoming', 'old']);
  });

  it('keeps every other project when one of them refreshes its own entry', async () => {
    const db = new FakeIndexedDbClient();
    db.seed({ projectId: 'a', payload: 'a', lastAccessed: 1 });
    db.seed({ projectId: 'b', payload: 'b', lastAccessed: 2 });

    await buildCache(db, 2).write('a', { payload: 'a2' });

    expect(db.keys().sort()).toEqual(['a', 'b']);
  });

  it('raises when the entry itself cannot be written', async () => {
    const db = new FakeIndexedDbClient();
    db.refuseWrites = true;

    await expect(buildCache(db).write('a', { payload: 'a' })).rejects.toThrow();
  });
});
