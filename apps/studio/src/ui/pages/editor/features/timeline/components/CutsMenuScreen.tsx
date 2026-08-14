import { AudioWaveform, ChevronRight, RotateCcw } from 'lucide-react';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';

const SCREEN_CLASS = 'p-2 flex flex-col gap-1.5 w-[240px] box-border';

const ACTION_BTN =
  'flex items-center gap-2 w-full text-left text-2xs px-2 py-[7px] rounded-xs border-none bg-transparent cursor-pointer whitespace-nowrap '
  + 'text-fg-secondary transition-colors duration-quick ease-standard '
  + 'hover:bg-surface-3 hover:text-fg-primary '
  + 'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary '
  + 'disabled:text-fg-faint disabled:hover:bg-transparent disabled:cursor-not-allowed';

// The entries above open a screen of their own; this one acts on the
// press. The rule separates the two kinds rather than the two subjects.
const DIVIDER_CLASS = 'my-1 border-t border-edge-subtle';


export interface CutsMenuScreenProps {
  /** False when the video carries no cuts, which leaves restoring inert. */
  canRestoreAll: boolean;
  onRestoreAll: () => void;
}

/**
 * Entry screen of the cut menu: the ways of making cuts automatically,
 * and the one way of taking them all back.
 *
 * Restoring stays listed and disabled on a video with no cuts rather
 * than disappearing. A menu whose entries come and go is harder to learn
 * than one with a greyed row, and the greyed row is also what tells a
 * reader the feature is there at all.
 *
 * Entries that depend on unavailable capabilities render as gated
 * affordances instead.
 */
export function CutsMenuScreen({ canRestoreAll, onRestoreAll }: CutsMenuScreenProps) {
  const { navigate, close } = usePopoverNav();

  const restoreAll = () => {
    onRestoreAll();
    close();
  };

  return (
    <div className={SCREEN_CLASS}>
      <PopoverHeader title="Cuts" />
      <button type="button" className={ACTION_BTN} onClick={() => navigate('silences')}>
        <AudioWaveform size={14} />
        <span className="flex-1">Remove silences</span>
        <ChevronRight size={13} className="text-fg-faint" />
      </button>
      <div className={DIVIDER_CLASS} />
      <button
        type="button"
        className={ACTION_BTN}
        onClick={restoreAll}
        disabled={!canRestoreAll}
      >
        <RotateCcw size={14} />
        <span className="flex-1">Restore all cuts</span>
      </button>
    </div>
  );
}
