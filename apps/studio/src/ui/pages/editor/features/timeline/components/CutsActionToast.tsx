import { Scissors } from 'lucide-react';
import { Toast, TOAST_AUTO_DISMISS_MS } from '@ui/_shared/components/Toast/Toast';

export interface CutsActionToastState {
  /** Remount key so back-to-back runs restart the auto-dismiss timer. */
  readonly key: number;
  /** Seconds the action took off the video; negative when it gave them back. */
  readonly removedSec: number;
  /** What the video lasts once the change is in. */
  readonly resultingSec: number;
}

interface CutsActionToastProps {
  readonly state: CutsActionToastState | null;
  readonly onDismiss: () => void;
}

/**
 * Outcome notice for the cut menu's actions: how much video the run took
 * away, or gave back, and what is left.
 *
 * The numbers are measured on the registry before and after rather than
 * summed from what was proposed, because the two differ. Ranges already
 * cut fuse into their neighbours instead of adding anything, and
 * compaction can swallow dead air nobody proposed — so the only honest
 * answer to "what did that do" is the difference it left behind.
 */
export function CutsActionToast({ state, onDismiss }: CutsActionToastProps) {
  if (state === null) return null;

  const { removedSec, resultingSec } = state;
  const changed = Math.abs(removedSec) >= 0.05;
  const title = !changed
    ? 'Nothing changed'
    : removedSec > 0
      ? `Removed ${formatDuration(removedSec)} of video`
      : `Restored ${formatDuration(-removedSec)} of video`;

  return (
    <Toast
      key={state.key}
      open
      position="bottom-right"
      tone={changed ? 'success' : 'info'}
      icon={<Scissors size={16} strokeWidth={2.5} />}
      title={title}
      description={
        changed
          ? `The video now runs ${formatDuration(resultingSec)}.`
          : 'Every one of those stretches was already cut.'
      }
      duration={TOAST_AUTO_DISMISS_MS}
      onDismiss={onDismiss}
    />
  );
}

// Tenths below a minute and none above it: a couple of seconds shaved off
// is a different fact from a video's running time, and rounding the first
// to whole seconds can print "0s" for something that plainly happened.
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}
