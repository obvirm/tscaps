import { forwardRef } from 'react';
import { X } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

interface PickModeHeaderProps {
  title: string;
  hint: string;
  accentColor: string;
  cancelLabel: string;
  cancelHint: string;
  onCancel: () => void;
}

const CANCEL_BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-xs bg-transparent border-none cursor-pointer ' +
  'text-fg-faint hover:text-fg-secondary hover:bg-surface-2 ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2';

/**
 * Sticky top chrome for a scene pick session. Fills the same footprint
 * as the transcript's normal top-bar and shows the session's purpose
 * (title + short hint) plus a way out. Rendered on a raised surface with
 * a downward shadow so it reads as its own layer above the scrolling
 * scene list; the left accent stripe carries the pick session's identity
 * color so users associate the mode with whatever they are about to
 * define.
 */
export const PickModeHeader = forwardRef<HTMLDivElement, PickModeHeaderProps>(
  function PickModeHeader({ title, hint, accentColor, cancelLabel, cancelHint, onCancel }, ref) {
    return (
      <div
        ref={ref}
        className="sticky top-0 z-20 bg-surface-2 border-b border-edge-medium shadow-[0_6px_10px_-8px_rgba(0,0,0,0.35)]"
      >
        <div className="flex items-stretch">
          <span
            className="w-[4px] shrink-0"
            style={{ background: accentColor }}
            aria-hidden
          />
          <div className="flex items-center justify-between gap-3 px-3 py-2 flex-1 min-w-0">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-fg-primary leading-tight truncate">{title}</span>
              <span className="text-2xs text-fg-faint leading-tight truncate">{hint}</span>
            </div>
            <Tooltip text={cancelHint} position="bottom">
              <button
                type="button"
                className={CANCEL_BTN}
                onClick={onCancel}
                aria-label={cancelLabel}
              >
                <X size={14} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    );
  },
);
