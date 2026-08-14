import { useCallback, useMemo } from 'react';
import { RangeReplayController } from '@presentation/editor/controllers/RangeReplayController';
import { usePlayback } from '@ui/pages/editor/contexts/PlaybackContext';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';

/**
 * Plays one stretch of the video once, silently, stopping exactly at
 * its end, and does nothing at all while the user is playing the video
 * themselves. Nothing is left running when the caller goes away: the
 * stop is the surface's, not a timer's.
 */
export function useRangeReplay(): (startSec: number, endSec: number) => void {
  const playback = usePlayback();
  const store = useEditorStore();

  const controller = useMemo(
    () => new RangeReplayController(
      {
        // Read where it is asked for rather than subscribed to: a panel
        // that re-rendered on every tick to hold a value it only reads
        // on a click would cost far more than the click.
        isPlaying: () => store.snapshot().video.isPlaying,
        timeSec: () => store.snapshot().video.currentTime,
      },
      playback.seek,
      playback.play,
      playback.scheduleStopAt,
      playback.scheduleAudioMuteAt,
    ),
    [playback, store],
  );

  return useCallback((startSec: number, endSec: number) => controller.replay(startSec, endSec), [controller]);
}
