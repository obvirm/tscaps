import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { ProjectName } from '@core/projects/domain/ProjectName';
import type { ThumbnailGenerator } from '@core/projects/services/ThumbnailGenerator';
/**
 * Outcome of {@link CreateProjectAction.execute}.
 *
 * `videoStoreFailure` carries what stopped this device from keeping a
 * copy of the video, or `null` when it kept one. The project exists
 * either way; whether that failure is worth telling anyone depends on
 * what happens to the project afterwards, which the caller knows and
 * this action does not.
 */
export interface ProjectCreationOutcome {
  readonly videoStoreFailure: unknown | null;
}

/**
 * Establishes a fresh project's identity on top of the currently
 * loaded video: stamps a new id, derives a name from the file name,
 * generates a thumbnail (best-effort), patches the editor store with
 * all of that, and caches the video bytes into the shared blob cache
 * so a later save can read them back.
 *
 * Idempotent at the call site: callers should check `state.projectId`
 * and skip if a project already exists.
 *
 * Caching the video writes the largest thing the app ever stores, so
 * it is the step that fails for real-world reasons. It is handed back
 * and not raised: the bytes remain reachable through the cache's
 * in-memory tier, which is what a session with no room left on disk
 * still uploads from, and refusing to establish the project would
 * only take the reader's work away for a copy nothing needs yet.
 */
export class CreateProjectAction {
  constructor(
    private readonly store: EditorStore,
    private readonly repository: ProjectRepository,
    private readonly thumbnails: ThumbnailGenerator,
    private readonly projectName: ProjectName,
  ) {}

  async execute(): Promise<ProjectCreationOutcome> {
    const file = this.requireLoadedVideoFile();
    const thumbnail = await this.generateThumbnailBestEffort(file);
    const id = crypto.randomUUID();
    const videoStoreFailure = await this.cacheVideoBlobBestEffort(id, file);
    this.store.patch({
      projectId: id,
      projectName: this.deriveProjectName(file.name),
      projectCreatedAt: new Date(),
      projectThumbnail: thumbnail,
      dirty: true,
    });
    return { videoStoreFailure };
  }

  /**
   * The bytes stay reachable for the rest of the session whether or
   * not this device could keep them, so a refused write is not a
   * reason to leave the reader without a project. Resolves to what
   * refused the write, or `null` when it went through.
   */
  private async cacheVideoBlobBestEffort(id: string, file: File): Promise<unknown | null> {
    try {
      await this.repository.cacheVideoBlob(id, file);
      return null;
    } catch (cause) {
      return cause;
    }
  }

  private requireLoadedVideoFile(): File {
    const file = this.store.snapshot().video.file;
    if (!file) throw new Error('Cannot create project: no video file loaded');
    return file;
  }

  /**
   * Strips the file extension and clamps the result through
   * `ProjectName`, so a long filename lands as a truncated project
   * name rather than being rejected on the first save.
   */
  private deriveProjectName(fileName: string): string {
    const dot = fileName.lastIndexOf('.');
    const base = dot > 0 ? fileName.slice(0, dot) : fileName;
    return this.projectName.clamp(base);
  }

  private async generateThumbnailBestEffort(file: File): Promise<Blob | null> {
    try {
      return await this.thumbnails.generate(file);
    } catch {
      return null;
    }
  }
}
