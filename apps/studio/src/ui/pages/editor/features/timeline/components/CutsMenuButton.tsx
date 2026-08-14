import { forwardRef } from 'react';
import { Scissors } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

const ICON_BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-xs bg-transparent border-none cursor-pointer '
  + 'text-fg-secondary hover:text-fg-primary hover:bg-surface-2 '
  + 'transition-colors duration-quick ease-standard '
  + 'focus-visible:outline-none focus-visible:bg-surface-2 '
  + 'data-[state=open]:bg-surface-3 data-[state=open]:text-fg-primary '
  + 'disabled:text-fg-faint disabled:hover:bg-transparent disabled:cursor-not-allowed';

/**
 * Toolbar affordance that opens the cut menu. Forwards refs so Radix
 * `Trigger asChild` can anchor the popover to the underlying `<button>`.
 * Visual state ("open" highlight) is driven by the `data-state`
 * attribute Radix sets on the trigger.
 */
export const CutsMenuButton = forwardRef<HTMLButtonElement>(
  function CutsMenuButton(props, ref) {
    return (
      <Tooltip text="Cuts" position="bottom">
        <button
          {...props}
          ref={ref}
          type="button"
          className={ICON_BTN}
          aria-label="Cuts"
        >
          <Scissors size={14} />
        </button>
      </Tooltip>
    );
  },
);
