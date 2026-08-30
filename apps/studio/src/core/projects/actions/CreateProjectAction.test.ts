import { describe, expect, it } from 'vitest';
import { CreateProjectAction } from '@core/projects/actions/CreateProjectAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ProjectName } from '@core/projects/domain/ProjectName';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { ThumbnailGenerator } from '@core/projects/services/ThumbnailGenerator';

/**
 * A device with no room left must still get a project: the video is
 * in memory for the rest of the session, and refusing to establish
 * one would take away work that is otherwise editable and exportable.
 * What refused the copy is handed back rather than announced, because
 * whether it is worth saying depends on the save that follows.
 */

describe('CreateProjectAction', () => {
  const substitute = <T>(stub: object): T => stub as T;

  const buildAction = (repository: ProjectRepository) => {
    const store = new EditorStore();
    store.patchVideo({ file: new File(['frames'], 'holiday.mp4', { type: 'video/mp4' }) });
    const action = new CreateProjectAction(
      store,
      repository,
      substitute<ThumbnailGenerator>({ generate: () => Promise.resolve(new Blob()) }),
      new ProjectName(),
    );
    return { action, store };
  };

  const refusingRepository = () => substitute<ProjectRepository>({
    cacheVideoBlob: () => Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError')),
  });

  it('establishes the project when the device cannot keep the video', async () => {
    const { action, store } = buildAction(refusingRepository());

    await action.execute();

    expect(store.snapshot().projectId).not.toBeNull();
    expect(store.snapshot().projectName).toBe('holiday');
  });

  it('hands back what refused the copy', async () => {
    const { action } = buildAction(refusingRepository());

    const outcome = await action.execute();

    expect((outcome.videoStoreFailure as DOMException).name).toBe('QuotaExceededError');
  });

  it('hands back nothing when the video was kept', async () => {
    const { action } = buildAction(substitute<ProjectRepository>({
      cacheVideoBlob: () => Promise.resolve(),
    }));

    const outcome = await action.execute();

    expect(outcome.videoStoreFailure).toBeNull();
  });
});
