import type { EditorStore } from '@core/editor/store/EditorStore';
import type { HiddenVideoLoader } from '@core/person-segmentation/services/HiddenVideoLoader';
import type {
  ScanVideoSource,
  ScanVideoSourceIdentity,
  ScanVideoSourceResolver,
} from '@core/person-segmentation/services/ScanVideoSourceResolver';

/**
 * A decoding video held open across several stretches of analysis.
 *
 * Loading a hidden video element costs a metadata parse and a first
 * frame, so a caller working through a video a chunk at a time pays
 * that once by keeping the element open between chunks rather than
 * opening one per chunk. Idempotent: opening an already-open session
 * hands back the same element.
 *
 * What is held open is one particular video, not "the project's
 * video". A session opened before a swap is closed and reopened
 * against the new file rather than going on decoding the old one.
 *
 * The caller closes it when the work runs out; nothing here decides
 * when that is.
 */
export class PersonSegmentationSession {
  private source: ScanVideoSource | null = null;
  private video: HTMLVideoElement | null = null;
  private openFor: ScanVideoSourceIdentity | null = null;
  private opening: Promise<HTMLVideoElement> | null = null;

  constructor(
    private readonly editorStore: EditorStore,
    private readonly sourceResolver: ScanVideoSourceResolver,
    private readonly videoLoader: HiddenVideoLoader,
  ) {}

  /** The open video, opening one against the loaded project first if needed. Rejects when no video is loaded. */
  async open(): Promise<HTMLVideoElement> {
    const wanted = this.sourceResolver.identityOf(this.editorStore.snapshot().video);
    if (wanted === null) throw new Error('No video is loaded');
    if (this.opening !== null) await this.opening.catch(() => undefined);
    if (this.video !== null && this.openFor === wanted) return this.video;
    this.close();
    this.opening = this.load(wanted);
    try {
      return await this.opening;
    } finally {
      this.opening = null;
    }
  }

  close(): void {
    if (this.video !== null) this.videoLoader.dispose(this.video);
    this.source?.dispose();
    this.video = null;
    this.source = null;
    this.openFor = null;
  }

  private async load(wanted: ScanVideoSourceIdentity): Promise<HTMLVideoElement> {
    const source = this.sourceResolver.resolve(this.editorStore.snapshot().video);
    if (source === null) throw new Error('No video is loaded');
    try {
      const video = await this.videoLoader.load(source.url);
      this.source = source;
      this.video = video;
      this.openFor = wanted;
      return video;
    } catch (error) {
      source.dispose();
      throw error;
    }
  }
}
