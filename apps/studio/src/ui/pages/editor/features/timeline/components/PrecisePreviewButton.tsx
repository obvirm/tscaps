import { forwardRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

const ICON_BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-xs bg-transparent border-none cursor-pointer '
  + 'text-warning hover:text-fg-primary hover:bg-surface-2 '
  + 'transition-colors duration-quick ease-standard '
  + 'focus-visible:outline-none focus-visible:bg-surface-2 '
  + 'data-[state=open]:bg-surface-3 data-[state=open]:text-fg-primary';

/**
 * Toolbar affordance signalling the preview is running in fast mode
 * and opening the explanation popover. Forwards refs so Radix
 * `Trigger asChild` can anchor the popover to the underlying
 * `<button>`.
 */
export const PrecisePreviewButton = forwardRef<HTMLButtonElement>(
  function PrecisePreviewButton(props, ref) {
    return (
      <Tooltip text="Fast preview mode" position="bottom">
        <button
          {...props}
          ref={ref}
          type="button"
          className={ICON_BTN}
          aria-label="Fast preview mode"
        >
          <AlertTriangle size={14} />
        </button>
      </Tooltip>
    );
  },
);
