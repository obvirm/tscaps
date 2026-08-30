import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { SupportDialog } from '@ui/pages/editor/features/support/SupportDialog';

const BUTTON =
  'inline-flex items-center justify-center w-8 h-8 bg-transparent border border-transparent rounded-xs ' +
  'text-fg-secondary cursor-pointer transition-colors duration-quick ease-standard ' +
  'hover:bg-surface-2 hover:border-edge-medium hover:text-fg-primary ' +
  'focus-visible:outline-none focus-visible:border-accent';

/**
 * Toolbar entry point for the "Support tscaps" modal. Owns its own
 * open/close state — parent only decides whether to render it.
 */
export function SupportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip text="Support tscaps" position="bottom">
        <button
          type="button"
          className={BUTTON}
          onClick={() => setOpen(true)}
          aria-label="Support tscaps"
        >
          <Heart size={16} strokeWidth={1.75} />
        </button>
      </Tooltip>
      <SupportDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
