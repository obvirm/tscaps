import type { ReactElement, ReactNode } from 'react';
import { Anchor, Mic, Mountain, Plus } from 'lucide-react';
import type { SheetCreationOption } from '@core/sheets/domain/SheetCreationOption';
import { SHEET_ROLES, type SheetRole } from '@core/sheets/domain/SheetRole';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';

interface AddSheetPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The "+" button, used as both trigger and anchor. */
  trigger: ReactElement;
  triggerTooltip: string;
  /** Sheets the project can add by name, in offer order. */
  creationOptions: ReadonlyArray<SheetCreationOption>;
  onCreateFromOption: (option: SheetCreationOption) => void;
  onPickCustom: () => void;
}

const MENU_SHAPE = 'p-1 flex flex-col gap-0.5 min-w-[240px]';
const ITEM =
  'flex items-start gap-2 text-left w-full px-2 py-1.5 rounded-xs border-none bg-transparent cursor-pointer ' +
  'transition-colors duration-quick ease-standard text-fg-secondary hover:bg-surface-3 hover:text-fg-primary ' +
  'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary';
const ITEM_ICON = 'mt-[2px] shrink-0';
const ITEM_LABEL = 'text-2xs font-medium';
const ITEM_LEGEND = 'text-2xs text-fg-faint';

const ROLE_ICONS: Readonly<Record<SheetRole, ReactNode>> = {
  hook: <Anchor size={13} />,
  peak: <Mountain size={13} />,
};

/** What each role puts in its sheet, in the user's terms. */
const ROLE_LEGENDS: Readonly<Record<SheetRole, string>> = {
  hook: 'The opening line of the video.',
  peak: 'The most important lines of the video.',
};

/**
 * Menu behind the "+" of the sheet selector, offering the sheets this
 * project can add by name before the blank one everyone can always make.
 * Rendered only while something is on offer — with nothing to choose
 * between, the "+" goes straight to the naming dialog it always did.
 */
export function AddSheetPopover({
  open, onOpenChange, trigger, triggerTooltip, creationOptions, onCreateFromOption, onPickCustom,
}: AddSheetPopoverProps) {
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      triggerTooltip={triggerTooltip}
      side="bottom"
      align="start"
      screens={{
        menu: (
          <AddSheetMenuScreen
            creationOptions={creationOptions}
            onCreateFromOption={onCreateFromOption}
            onPickCustom={onPickCustom}
          />
        ),
      }}
    />
  );
}

interface AddSheetMenuScreenProps {
  creationOptions: ReadonlyArray<SheetCreationOption>;
  onCreateFromOption: (option: SheetCreationOption) => void;
  onPickCustom: () => void;
}

function AddSheetMenuScreen({ creationOptions, onCreateFromOption, onPickCustom }: AddSheetMenuScreenProps) {
  const { close } = usePopoverNav();
  return (
    <div className={MENU_SHAPE}>
      {creationOptions.map((option) => (
        <MenuItem
          key={optionKey(option)}
          icon={option.kind === 'role' ? ROLE_ICONS[option.role] : <Mic size={13} />}
          label={option.kind === 'role' ? SHEET_ROLES[option.role].name : option.name}
          legend={option.kind === 'role' ? ROLE_LEGENDS[option.role] : 'Everything this speaker says.'}
          onPick={() => { close(); onCreateFromOption(option); }}
        />
      ))}
      <MenuItem
        icon={<Plus size={13} />}
        label="Custom…"
        legend="A sheet you name and assign yourself."
        onPick={() => { close(); onPickCustom(); }}
      />
    </div>
  );
}

function optionKey(option: SheetCreationOption): string {
  return option.kind === 'role' ? `role:${option.role}` : `speaker:${option.speakerId}`;
}

interface MenuItemProps {
  icon: ReactNode;
  label: string;
  legend: string;
  onPick: () => void;
}

function MenuItem({ icon, label, legend, onPick }: MenuItemProps) {
  return (
    <button type="button" className={ITEM} onClick={onPick}>
      <span className={ITEM_ICON}>{icon}</span>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className={ITEM_LABEL}>{label}</span>
        <span className={ITEM_LEGEND}>{legend}</span>
      </span>
    </button>
  );
}
