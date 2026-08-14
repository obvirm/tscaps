import { forwardRef } from 'react';
import { Megaphone, Wand2 } from 'lucide-react';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';

interface TranscriptActionsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canAutoAssign: boolean;
  onSetHookScenes: () => void;
  onOpenAutoAssign: () => void;
}

const TRIGGER_BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-xs bg-transparent border-none cursor-pointer ' +
  'text-fg-secondary hover:text-fg-primary hover:bg-surface-2 ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2 ' +
  'data-[state=open]:bg-surface-3 data-[state=open]:text-fg-primary';

const SCREEN_CLASS = 'p-2 flex flex-col gap-1.5 w-[240px] box-border';

const ACTION_BTN =
  'flex items-center gap-2 w-full text-left text-2xs px-2 py-[7px] rounded-xs border-none bg-transparent cursor-pointer whitespace-nowrap ' +
  'text-fg-secondary transition-colors duration-quick ease-standard ' +
  'hover:bg-surface-3 hover:text-fg-primary ' +
  'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary';

/**
 * Popover anchored to the transcript topbar that lists the scene-level
 * actions available on the whole transcript. Currently: designate the
 * opening scenes as the hook, and auto-group scenes by matcher.
 * Entries whose capability is unavailable on the current surface are
 * hidden rather than disabled.
 */
export function TranscriptActionsPopover({
  open,
  onOpenChange,
  canAutoAssign,
  onSetHookScenes,
  onOpenAutoAssign,
}: TranscriptActionsPopoverProps) {
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger={<TriggerButton />}
      triggerTooltip="Scene actions"
      screens={{
        menu: (
          <MenuScreen
            canAutoAssign={canAutoAssign}
            onSetHookScenes={onSetHookScenes}
            onOpenAutoAssign={onOpenAutoAssign}
          />
        ),
      }}
      initialScreen="menu"
      align="end"
    />
  );
}

const TriggerButton = forwardRef<HTMLButtonElement>(
  function TriggerButton(props, ref) {
    return (
      <button
        {...props}
        ref={ref}
        type="button"
        className={TRIGGER_BTN}
        aria-label="Scene actions"
      >
        <Wand2 size={14} />
      </button>
    );
  },
);

interface MenuScreenProps {
  canAutoAssign: boolean;
  onSetHookScenes: () => void;
  onOpenAutoAssign: () => void;
}

function MenuScreen({ canAutoAssign, onSetHookScenes, onOpenAutoAssign }: MenuScreenProps) {
  const { close } = usePopoverNav();
  return (
    <div className={SCREEN_CLASS}>
      <PopoverHeader title="Scene actions" />
      <button
        type="button"
        className={ACTION_BTN}
        onClick={() => { close(); onSetHookScenes(); }}
      >
        <Megaphone size={14} />
        <span className="flex-1">Set hook scenes</span>
      </button>
      {canAutoAssign && (
        <button
          type="button"
          className={ACTION_BTN}
          onClick={() => { close(); onOpenAutoAssign(); }}
        >
          <Wand2 size={14} />
          <span className="flex-1">Group scenes by rule</span>
        </button>
      )}
    </div>
  );
}
