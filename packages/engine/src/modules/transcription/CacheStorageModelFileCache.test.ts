import { afterEach, describe, expect, it, vi } from 'vitest';
import { CacheStorageModelFileCache } from '@modules/transcription/CacheStorageModelFileCache';
import { ModelFileCacheUnavailableError } from '@modules/transcription/ModelFileCacheUnavailableError';

/**
 * In-memory stand-in for one Cache Storage bucket. `refusal` makes
 * every write fail the way a browser out of room does.
 */
class FakeCache {
  private readonly entries = new Map<string, Response>();

  constructor(private readonly refusal: Error | null = null) {}

  async match(key: string): Promise<Response | undefined> {
    return this.entries.get(key);
  }

  async put(key: string, response: Response): Promise<void> {
    if (this.refusal) throw this.refusal;
    this.entries.set(key, response);
  }
}

function installCacheStorage(cache: FakeCache | null): void {
  vi.stubGlobal('caches', {
    open: async () => {
      if (!cache) throw new Error('refused to open');
      return cache;
    },
  });
}

function quotaExceeded(): Error {
  const error = new Error('quota exceeded');
  error.name = 'QuotaExceededError';
  return error;
}

describe('CacheStorageModelFileCache', () => {

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads back a file it kept', async () => {
    installCacheStorage(new FakeCache());
    const cache = new CacheStorageModelFileCache(() => undefined);

    await cache.put('https://host/model.onnx', new Response('weights'));

    expect(await (await cache.match('https://host/model.onnx'))?.text()).toBe('weights');
  });

  it('reports a miss for a file it never kept', async () => {
    installCacheStorage(new FakeCache());
    const cache = new CacheStorageModelFileCache(() => undefined);

    expect(await cache.match('https://host/model.onnx')).toBeUndefined();
  });

  it('announces the refusal that stopped a file from being kept', async () => {
    installCacheStorage(new FakeCache(quotaExceeded()));
    const announced: unknown[] = [];
    const cache = new CacheStorageModelFileCache((error) => announced.push(error));

    await cache.put('https://host/model.onnx', new Response('weights'));

    expect((announced[0] as Error).name).toBe('QuotaExceededError');
  });

  it('announces only the first refusal, since a model is several files', async () => {
    installCacheStorage(new FakeCache(quotaExceeded()));
    const announced: unknown[] = [];
    const cache = new CacheStorageModelFileCache((error) => announced.push(error));

    await cache.put('https://host/encoder.onnx', new Response('weights'));
    await cache.put('https://host/decoder.onnx', new Response('weights'));
    await cache.put('https://host/tokenizer.json', new Response('{}'));

    expect(announced).toHaveLength(1);
  });

  it('announces that there is nowhere to keep files when the runtime has no cache storage', async () => {
    vi.stubGlobal('caches', undefined);
    const announced: unknown[] = [];
    const cache = new CacheStorageModelFileCache((error) => announced.push(error));

    await cache.put('https://host/model.onnx', new Response('weights'));

    expect((announced[0] as Error).name).toBe(ModelFileCacheUnavailableError.ERROR_NAME);
  });

  it('reports a miss instead of failing when the cache cannot be opened', async () => {
    installCacheStorage(null);
    const cache = new CacheStorageModelFileCache(() => undefined);

    expect(await cache.match('https://host/model.onnx')).toBeUndefined();
  });
});
