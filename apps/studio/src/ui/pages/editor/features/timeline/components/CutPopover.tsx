import type { ReactElement } from 'react';
import { RotateCcw } from 'lucide-react';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';

const SCREEN_CLASS = 'p-2 flex flex-col gap-1.5 w-[200px] box-border';

const ACTION_BTN =
  'flex items-center gap-2 w-full text-left text-2xs px-2 py-[7px] rounded-xs border-none bg-transparent cursor-pointer whitespace-nowrap '
  + 'text-fg-secondary transition-colors duration-quick ease-standard '
  + 'hover:bg-surface-3 hover:text-fg-primary '
  + 'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary';

interface CutPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  durationSec: number;
  /** The cut's mask, which anchors the popover and opens it when pressed. */
  trigger: ReactElement;
  /** Where inside the mask it was pressed, in pixels from the mask's left edge. */
  pressOffsetPx: number;
  onRestore: () => void;
}

/**
 * What can be done with one stored cut.
 *
 * A cut is as wide as it is long, so it is narrower than any control at
 * a tenth of a second and wider than the panel at half a minute. A
 * floating menu survives both, because it takes the size it needs and
 * is pushed back inside the viewport on its own.
 *
 * It opens at the point that was pressed rather than at the mask's own
 * edge. Those are the same place on a button and a whole row apart on a
 * cut that fills one, and a menu that lands at the far end of the row
 * from the pointer is a menu the user has to go and find.
 */
export function CutPopover({
  open,
  onOpenChange,
  durationSec,
  trigger,
  pressOffsetPx,
  onRestore,
}: CutPopoverProps) {
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      alignOffset={pressOffsetPx}
      screens={{
        menu: (
          // A portal moves the DOM node out but not the React tree, so a
          // press here still reaches the timeline, which reads it as a
          // range drag and captures the pointer — swallowing the release
          // the button under the finger was waiting for.
          <div className={SCREEN_CLASS} onPointerDown={(e) => e.stopPropagation()}>
            <PopoverHeader title={`Cut · ${durationSec.toFixed(2)}s`} />
            <button
              type="button"
              className={ACTION_BTN}
              onClick={() => { onOpenChange(false); onRestore(); }}
            >
              <RotateCcw size={14} />
              <span className="flex-1">Restore this cut</span>
            </button>
          </div>
        ),
      }}
    />
  );
}
