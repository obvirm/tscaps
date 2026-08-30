import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ProjectName } from '@core/projects/domain/ProjectName';

/**
 * Updates the active project's display name and flags the editor as
 * having unsaved changes. The name is clamped through `ProjectName`
 * so empty rewrites fall back to a placeholder and oversized input
 * (e.g. pasted from a long string) is truncated to the persisted
 * limit rather than rejected on save.
 */
export class RenameProjectAction {
  constructor(
    private readonly store: EditorStore,
    private readonly projectName: ProjectName,
  ) {}

  execute(name: string): void {
    if (!this.store.snapshot().projectId) return;
    this.store.patch({
      projectName: this.projectName.clamp(name),
      dirty: true,
    });
  }
}
