import { useMemo } from 'react';
import type { ScenePickSnapshot } from '@presentation/editor/controllers/ScenePickController';

const EMPTY_ID_SET: ReadonlySet<string> = new Set();
const IDLE_PICK_SELECTION: ScenePickSelection = { committed: EMPTY_ID_SET, preview: EMPTY_ID_SET };

/**
 * Two live selections the transcript scenes render against at once:
 *
 * - `committed` — what is actually selected right now (rendered strong).
 * - `preview` — what would be selected if the user commits the current
 *   hover (rendered lightly for scenes not already in `committed`).
 *
 * When the user is not hovering, `preview` equals `committed` so no
 * "would-be-added" overlay leaks onto idle scenes.
 */
export interface ScenePickSelection {
  readonly committed: ReadonlySet<string>;
  readonly preview: ReadonlySet<string>;
}

/**
 * Resolves the committed + preview selections a scene overlay should
 * render against. Under `contiguous-from-start`, hovering a scene grows
 * the preview to `[first..hovered]`; other constraints leave preview
 * equal to committed. While pick mode is idle both sets are empty.
 */
export function useEffectivePickSelection(
  snapshot: ScenePickSnapshot,
  orderedSceneIds: ReadonlyArray<string>,
): ScenePickSelection {
  return useMemo<ScenePickSelection>(() => {
    if (!snapshot.isActive) return IDLE_PICK_SELECTION;
    const committed = snapshot.selection;
    if (snapshot.hoveredBoundary === null || snapshot.constraint !== 'contiguous-from-start') {
      return { committed, preview: committed };
    }
    const idx = orderedSceneIds.indexOf(snapshot.hoveredBoundary);
    if (idx < 0) return { committed, preview: committed };
    return { committed, preview: new Set(orderedSceneIds.slice(0, idx + 1)) };
  }, [snapshot, orderedSceneIds]);
}
