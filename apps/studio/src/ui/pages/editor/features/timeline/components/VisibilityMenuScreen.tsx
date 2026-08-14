import type { ReactNode } from 'react';
import { AudioWaveform, Check } from 'lucide-react';
import type { TimelineDetail } from '@core/timeline/domain/TimelineDetail';
import type { TimelineDetailVisibility } from '@presentation/timeline/controllers/TimelineVisibilityController';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';

const ICON_SIZE_PX = 13;

/**
 * Every detail a reader can turn off, in the order they are drawn down a
 * row. One entry here and one id in {@link TimelineDetail} is the whole
 * cost of making something else optional.
 */
const DETAILS: ReadonlyArray<{ id: TimelineDetail; label: string; icon: ReactNode }> = [
  { id: 'waveform', label: 'Waveform', icon: <AudioWaveform size={ICON_SIZE_PX} /> },
];

const SCREEN_CLASS = 'p-2 flex flex-col gap-1 w-[190px] box-border';

const ENTRY_CLASS =
  'flex items-center gap-2 w-full text-left text-2xs px-2 py-[7px] rounded-xs '
  + 'border-none bg-transparent cursor-pointer '
  + 'transition-colors duration-quick ease-standard '
  + 'hover:bg-surface-3 hover:text-fg-primary '
  + 'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary';

const ENTRY_SHOWN_CLASS = 'text-fg-secondary';
const ENTRY_HIDDEN_CLASS = 'text-fg-faint';

const LABEL_CLASS = 'min-w-0 flex-1 truncate';

const CHECK_CLASS = 'shrink-0 text-accent';

interface VisibilityMenuScreenProps {
  visible: TimelineDetailVisibility;
  onToggle: (detail: TimelineDetail) => void;
}

/**
 * The list of what a row draws, each entry turned on or off on the
 * press.
 *
 * The menu stays open afterwards: turning something on changes the
 * height of every row at once, and closing over that would hand the
 * reader a redrawn panel with no way back that they can still see.
 */
export function VisibilityMenuScreen({ visible, onToggle }: VisibilityMenuScreenProps) {
  return (
    <div className={SCREEN_CLASS}>
      <PopoverHeader title="View" />
      {DETAILS.map((detail) => {
        const isShown = visible[detail.id];
        return (
          <button
            key={detail.id}
            type="button"
            className={`${ENTRY_CLASS} ${isShown ? ENTRY_SHOWN_CLASS : ENTRY_HIDDEN_CLASS}`}
            aria-pressed={isShown}
            onClick={() => onToggle(detail.id)}
          >
            {detail.icon}
            <span className={LABEL_CLASS}>{detail.label}</span>
            {isShown && <Check className={CHECK_CLASS} size={ICON_SIZE_PX} />}
          </button>
        );
      })}
    </div>
  );
}
