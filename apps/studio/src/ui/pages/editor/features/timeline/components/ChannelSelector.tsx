import { useState } from 'react';
import { Check, Layers } from 'lucide-react';
import type { TimelineChannel } from '@presentation/timeline/services/TimelineChannelResolver';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';

const TRIGGER_CLASS =
  'flex items-center gap-1.5 px-2 h-7 rounded-xs border-none bg-transparent cursor-pointer '
  + 'text-2xs text-fg-secondary transition-colors duration-quick ease-standard '
  + 'hover:bg-surface-3 hover:text-fg-primary '
  + 'focus-visible:outline-none focus-visible:bg-surface-3';

const TRIGGER_NAME_CLASS = 'max-w-[10ch] truncate';

const SCREEN_CLASS = 'p-2 flex flex-col gap-1 w-[200px] box-border';

const ENTRY_CLASS =
  'flex items-center gap-2 w-full overflow-hidden text-left text-2xs px-2 py-[7px] rounded-xs '
  + 'border-none bg-transparent cursor-pointer '
  + 'text-fg-secondary transition-colors duration-quick ease-standard '
  + 'hover:bg-surface-3 hover:text-fg-primary '
  + 'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary';

const ENTRY_ACTIVE_CLASS = 'bg-surface-3 text-fg-primary';

const NAME_CLASS = 'min-w-0 flex-1 truncate';

const CHECK_CLASS = 'shrink-0 text-accent';

const ICON_SIZE_PX = 12;

interface ChannelSelectorProps {
  channels: ReadonlyArray<TimelineChannel>;
  selectedId: string | null;
  onSelect: (channelId: string) => void;
}

/**
 * Which track of text the timeline is reading.
 *
 * Absent unless there is a choice: a document whose sheets never claim
 * the same instant is read in one channel, which is every document until
 * someone deliberately puts two texts on screen at once.
 *
 * Switching never changes the row grid. The rows are the video's clock,
 * so the same second sits in the same place in every channel and the
 * reader can carry their place across — which also means a channel
 * holding one short line still spans the whole video, mostly empty. That
 * emptiness is the truth about that track, not a gap to be closed.
 */
export function ChannelSelector({ channels, selectedId, onSelect }: ChannelSelectorProps) {
  const [isOpen, setOpen] = useState(false);
  if (channels.length < 2) return null;

  const selected = channels.find((channel) => channel.id === selectedId) ?? channels[0]!;
  const pick = (channelId: string) => {
    onSelect(channelId);
    setOpen(false);
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={setOpen}
      align="start"
      trigger={(
        <button type="button" className={TRIGGER_CLASS} title="Text channel">
          <Layers size={ICON_SIZE_PX} />
          <span className={TRIGGER_NAME_CLASS}>{selected.name}</span>
        </button>
      )}
      screens={{
        list: (
          <div className={SCREEN_CLASS}>
            <PopoverHeader title="Text channel" />
            {channels.map((channel) => {
              const isSelected = channel.id === selected.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  className={`${ENTRY_CLASS} ${isSelected ? ENTRY_ACTIVE_CLASS : ''}`}
                  title={channel.name}
                  aria-pressed={isSelected}
                  onClick={() => pick(channel.id)}
                >
                  <span className={NAME_CLASS}>{channel.name}</span>
                  {isSelected && <Check className={CHECK_CLASS} size={ICON_SIZE_PX} />}
                </button>
              );
            })}
          </div>
        ),
      }}
    />
  );
}
