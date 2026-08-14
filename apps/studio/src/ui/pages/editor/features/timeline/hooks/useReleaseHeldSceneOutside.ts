import { useEffect, type RefObject } from 'react';
import { useTimelineEditingController } from '@ui/pages/editor/features/timeline/contexts/TimelineEditingContext';

/**
 * Marks a floating layer as belonging to the held scene, so a press
 * inside it is not read as a press somewhere else.
 */
export const SCENE_SURFACE_ATTRIBUTE = 'data-scene-surface';

/**
 * Lets go of the held scene when a press lands outside the panel.
 *
 * Presses *inside* the panel already release it — every one of them
 * starts a range drag, takes another scene, or selects a word — so this
 * only covers the rest of the editor, where nothing would otherwise say
 * the scene had stopped being the thing under the reader's hands.
 *
 * A selection deliberately survives the same press, because it can be
 * played in a loop and has an explicit Cancel. A held scene has neither.
 *
 * The scene's own menu is rendered through a portal, which puts it
 * outside the panel's DOM and would make pressing it look like pressing
 * somewhere else entirely. It is found by its own attribute rather than
 * by the popover library's internals.
 *
 * **While that menu is open, an outside press only dismisses it.** The
 * menu opens by itself as part of taking hold of the scene, so closing
 * it is not the reader saying they are done with the scene — it is them
 * saying they are done reading. Letting one press do both took the scene
 * away every time the menu was dismissed.
 */
export function useReleaseHeldSceneOutside(panelRef: RefObject<HTMLElement | null>): void {
  const controller = useTimelineEditingController();

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (controller.selectedSceneId === null) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest(`[${SCENE_SURFACE_ATTRIBUTE}]`)) return;
      if (document.querySelector(`[${SCENE_SURFACE_ATTRIBUTE}]`)) return;
      controller.clearSceneSelection();
    };
    // Capture, so the menu is still mounted to be found: the library
    // dismisses it on this same event, and two listeners on the bubble
    // phase would run in whichever order they happened to be registered.
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [controller, panelRef]);
}
