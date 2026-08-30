import type { VideoBlobCache } from '@core/videos/domain/VideoBlobCache';

interface HeldVideo {
  readonly projectId: string;
  readonly blob: Blob;
}

/**
 * `VideoBlobCache` that keeps the open project's bytes in memory in
 * front of a durable cache, and answers from memory before touching
 * it.
 *
 * Holding one project is the whole design: the editor works on one at
 * a time, and the blob held here is the same object the editor state
 * already references for the length of the session, so nothing is
 * copied and nothing outlives the project it belongs to.
 *
 * What this buys is a device with no room left. The durable write
 * still raises — whoever asked to keep the bytes has to learn it did
 * not happen — but the bytes stay reachable for the rest of the
 * session, which is what lets a project upload a video the device it
 * was dropped on refused to store.
 */
export class MemoryFirstVideoBlobCache implements VideoBlobCache {
  private held: HeldVideo | null = null;

  constructor(private readonly durable: VideoBlobCache) {}

  async load(projectId: string): Promise<Blob | null> {
    if (this.held?.projectId === projectId) return this.held.blob;
    const blob = await this.durable.load(projectId);
    if (blob) this.held = { projectId, blob };
    return blob;
  }

  /**
   * Holds `blob` before the durable write is attempted, so a refused
   * write leaves the bytes reachable rather than losing them.
   */
  async store(projectId: string, blob: Blob): Promise<void> {
    this.held = { projectId, blob };
    await this.durable.store(projectId, blob);
  }

  async delete(projectId: string): Promise<void> {
    if (this.held?.projectId === projectId) this.held = null;
    await this.durable.delete(projectId);
  }
}
