import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useState, type AnimationEvent, type ReactNode } from 'react';
import { useToastStacks, type ToastPosition } from '@ui/_shared/components/Toast/ToastStack';
import { useToastDismissTimer } from '@ui/_shared/components/Toast/useToastDismissTimer';
import { useSwipeToDismiss } from '@ui/_shared/components/Toast/useSwipeToDismiss';

export type ToastTone = 'info' | 'success' | 'error';

/**
 * How long a timed toast holds the screen. Long enough to read a title
 * and a line of description while looking somewhere else first; the hold
 * on hover covers whoever needs longer than that.
 */
export const TOAST_AUTO_DISMISS_MS = 6000;

interface ToastProps {
  readonly open: boolean;
  readonly icon?: ReactNode;
  readonly tone?: ToastTone;
  readonly title: string;
  readonly description?: string;
  readonly position?: ToastPosition;
  /** Auto-dismiss delay in milliseconds. Omit for a persistent toast. */
  readonly duration?: number;
  readonly onDismiss: () => void;
}

const TONE_ICON: Record<ToastTone, string> = {
  info: 'text-fg-secondary',
  success: 'text-accent',
  error: 'text-danger',
};

const TONE_TIMER: Record<ToastTone, string> = {
  info: 'bg-fg-faint',
  success: 'bg-accent',
  error: 'bg-danger',
};

const ENTER_ANIMATION: Record<ToastPosition, string> = {
  'top-left': 'animate-toast-in-from-top',
  'top-center': 'animate-toast-in-from-top',
  'top-right': 'animate-toast-in-from-top',
  'bottom-left': 'animate-toast-in-from-bottom',
  'bottom-center': 'animate-toast-in-from-bottom',
  'bottom-right': 'animate-toast-in-from-bottom',
};

// The highest surface in the palette, above every panel the editor lays
// under it, with a popover's elevation to match. A toast that reads as
// one more panel is a toast people miss.
const CHROME =
  'pointer-events-auto relative overflow-hidden touch-none max-w-sm ' +
  'bg-surface-3 border border-edge-medium rounded-md shadow-md px-4 py-3 flex items-start gap-3';

/**
 * Corner notice for something that already happened. Auto-dismisses after
 * `duration`, or stays until dismissed when no duration is given — for
 * events the user may miss if they walked away from the tab.
 *
 * A timed toast draws its remaining time along the bottom edge and holds
 * that time while the pointer is over it or focus is inside it. It can
 * also be swiped away horizontally.
 *
 * Toasts sharing a position stack rather than overlap, so a
 * `ToastStackProvider` must sit above this component.
 */
export function Toast({ open, icon, tone = 'info', title, description, position = 'bottom-right', duration, onDismiss }: ToastProps) {
  const stacks = useToastStacks();
  const [exiting, setExiting] = useState(false);
  const [pointerHeld, setPointerHeld] = useState(false);
  const [focusHeld, setFocusHeld] = useState(false);
  const swipe = useSwipeToDismiss(onDismiss);

  // Reopening the same instance has to clear the exit left over from the
  // previous one. Adjusting during render instead of in an effect spares
  // the reopened toast a first frame painted on its way out.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setExiting(false);
  }

  const held = pointerHeld || focusHeld || swipe.dragging;
  useToastDismissTimer(exiting ? undefined : duration, held, () => setExiting(true));

  // The countdown bar's animation bubbles up here too, and letting it land
  // would drop the toast without playing the exit out.
  const endExitAnimation = (event: AnimationEvent<HTMLDivElement>) => {
    if (exiting && event.target === event.currentTarget) onDismiss();
  };

  if (!open) return null;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={`${CHROME} ${exiting ? 'animate-toast-out' : ENTER_ANIMATION[position]}`}
      style={{
        transform: `translateX(${swipe.offsetPx}px)`,
        opacity: swipe.opacity,
        transition: swipe.dragging ? 'none' : 'transform var(--motion-base) var(--ease-standard), opacity var(--motion-base) var(--ease-standard)',
      }}
      onPointerEnter={() => setPointerHeld(true)}
      onPointerLeave={() => setPointerHeld(false)}
      onFocus={() => setFocusHeld(true)}
      onBlur={() => setFocusHeld(false)}
      onAnimationEnd={endExitAnimation}
      {...swipe.handlers}
    >
      {icon && <span className={`shrink-0 mt-px ${TONE_ICON[tone]}`}>{icon}</span>}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm text-fg-primary leading-snug">{title}</span>
        {description && (
          <span className="text-xs text-fg-muted leading-snug">{description}</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setExiting(true)}
        aria-label="Dismiss"
        className="shrink-0 -mr-1 -mt-1 p-1 rounded-xs text-fg-faint cursor-pointer transition-colors duration-quick ease-standard hover:text-fg-secondary hover:bg-surface-2 focus-visible:outline-none focus-visible:border focus-visible:border-accent"
      >
        <X size={14} />
      </button>
      {duration !== undefined && !exiting && (
        <span
          aria-hidden
          className={`absolute inset-x-0 bottom-0 h-0.5 origin-left animate-toast-timer ${TONE_TIMER[tone]}`}
          style={{ animationDuration: `${duration}ms`, animationPlayState: held ? 'paused' : 'running' }}
        />
      )}
    </div>,
    stacks[position],
  );
}
