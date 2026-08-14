import { forwardRef } from 'react';
import { Eye } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

const ICON_BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-xs bg-transparent border-none cursor-pointer '
  + 'text-fg-secondary hover:text-fg-primary hover:bg-surface-2 '
  + 'transition-colors duration-quick ease-standard '
  + 'focus-visible:outline-none focus-visible:bg-surface-2 '
  + 'data-[state=open]:bg-surface-3 data-[state=open]:text-fg-primary';

const LABEL = 'View';

/**
 * Toolbar affordance that opens the menu of what the timeline shows.
 * Forwards refs so Radix `Trigger asChild` can anchor the popover to the
 * underlying `<button>`.
 *
 * It says nothing about what is currently on or off. A badge here could
 * only mean "this differs from the default", and that is not a fact
 * worth carrying: the default is ours to change, so the same panel would
 * start or stop being marked without the reader touching anything. What
 * a reader turned off they turned off deliberately, and it is one press
 * away from being read back.
 */
export const VisibilityMenuButton = forwardRef<HTMLButtonElement>(
  function VisibilityMenuButton(props, ref) {
    return (
      <Tooltip text={LABEL} position="bottom">
        <button
          {...props}
          ref={ref}
          type="button"
          className={ICON_BTN}
          aria-label={LABEL}
        >
          <Eye size={14} />
        </button>
      </Tooltip>
    );
  },
);
