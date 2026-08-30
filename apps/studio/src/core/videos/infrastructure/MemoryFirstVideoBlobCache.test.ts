import { describe, expect, it } from 'vitest';
import type { VideoBlobCache } from '@core/videos/domain/VideoBlobCache';
import { MemoryFirstVideoBlobCache } from '@core/videos/infrastructure/MemoryFirstVideoBlobCache';

/**
 * The promise that matters here is the one a device with no room left
 * depends on: bytes handed to the cache stay readable even when the
 * durable layer refuses them, which is what lets a project upload a
 * video its own disk would not store.
 */

class InMemoryDurableCache implements VideoBlobCache {
  private readonly blobs = new Map<string, Blob>();

  refuseWrites = false;

  load(projectId: string): Promise<Blob | null> {
    return Promise.resolve(this.blobs.get(projectId) ?? null);
  }

  store(projectId: string, blob: Blob): Promise<void> {
    if (this.refuseWrites) {
      return Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError'));
    }
    this.blobs.set(projectId, blob);
    return Promise.resolve();
  }

  delete(projectId: string): Promise<void> {
    this.blobs.delete(projectId);
    return Promise.resolve();
  }
}

describe('MemoryFirstVideoBlobCache', () => {
  const bytes = (text: string) => new Blob([text], { type: 'video/mp4' });
  const readBack = async (blob: Blob | null) => (blob === null ? null : blob.text());

  it('hands the video back after the durable layer refused to keep it', async () => {
    const durable = new InMemoryDurableCache();
    const cache = new MemoryFirstVideoBlobCache(durable);
    durable.refuseWrites = true;

    await expect(cache.store('a', bytes('frames'))).rejects.toThrow();

    expect(await readBack(await cache.load('a'))).toBe('frames');
  });

  it('holds one project at a time', async () => {
    const durable = new InMemoryDurableCache();
    const cache = new MemoryFirstVideoBlobCache(durable);
    durable.refuseWrites = true;
    await cache.store('a', bytes('first')).catch(() => undefined);

    await cache.store('b', bytes('second')).catch(() => undefined);

    expect(await cache.load('a')).toBeNull();
    expect(await readBack(await cache.load('b'))).toBe('second');
  });

  it('reads through to the durable layer for a project it is not holding', async () => {
    const durable = new InMemoryDurableCache();
    await durable.store('a', bytes('from disk'));

    const cache = new MemoryFirstVideoBlobCache(durable);

    expect(await readBack(await cache.load('a'))).toBe('from disk');
  });

  it('forgets the project it holds when that project is deleted', async () => {
    const durable = new InMemoryDurableCache();
    const cache = new MemoryFirstVideoBlobCache(durable);
    await cache.store('a', bytes('frames'));

    await cache.delete('a');

    expect(await cache.load('a')).toBeNull();
  });
});
