import { useCallback, useSyncExternalStore } from 'react';
import type { Theme } from '@presentation/theme/controllers/ThemeController';
import { useTheme } from '@bootstrap/ThemeContext';

/**
 * The light/dark theme in force right now, re-read when the user
 * switches it and when the OS preference moves under a `system` choice.
 *
 * For components that have to pass the theme to something that cannot
 * read CSS variables — a canvas, an embedded editor. Anything styled in
 * CSS should use the `[data-theme]` selectors instead and never re-render
 * for a theme change at all.
 */
export function useCurrentTheme(): Theme {
  const controller = useTheme();
  const subscribe = useCallback((notify: () => void) => {
    controller.addEventListener('change', notify);
    return () => controller.removeEventListener('change', notify);
  }, [controller]);
  return useSyncExternalStore(subscribe, () => controller.getTheme());
}
