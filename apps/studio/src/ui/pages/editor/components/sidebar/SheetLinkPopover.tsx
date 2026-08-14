import { Unlink } from 'lucide-react';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';

interface SheetLinkPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Viewport-space anchor — bottom-left of the chain icon. */
  point: { x: number; y: number };
  /** The sheet whose chain icon opened this popover. */
  sheet: Sheet;
  /** All sheets, used both to list linked siblings and to pick a link target. */
  sheets: ReadonlyArray<Sheet>;
  onLinkTo: (sourceSheetId: string) => void;
  onUnlink: () => void;
}

const MENU_SHAPE = 'p-1 flex flex-col gap-0.5 min-w-[220px]';
const ITEM =
  'flex items-center gap-2 text-left w-full text-2xs px-2 py-[5px] rounded-xs border-none bg-transparent cursor-pointer whitespace-nowrap ' +
  'transition-colors duration-quick ease-standard text-fg-secondary hover:bg-surface-3 hover:text-fg-primary ' +
  'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-fg-secondary';
const SIBLING_LINE =
  'flex items-center gap-2 text-left w-full text-2xs px-2 py-[5px] rounded-xs text-fg-secondary';

/**
 * Popover attached to a sheet's chain icon. Renders one of two shapes
 * depending on the sheet's link state:
 *
 * - Linked: an Unlink action and a read-only list of the other sheets in
 *   the same link group so the user sees what they are about to detach
 *   from.
 * - Free: a picker listing every other sheet the user can attach to. The
 *   pick joins that sheet's group (or forms a new group of two when the
 *   picked sheet is also free). The current sheet adopts the group's
 *   shared style.
 */
export function SheetLinkPopover(props: SheetLinkPopoverProps) {
  const screens = props.sheet.linkGroupId !== null
    ? { menu: <LinkedGroupScreen {...props} /> }
    : { menu: <LinkTargetPickerScreen {...props} /> };
  return (
    <Popover
      open={props.open}
      onOpenChange={props.onOpenChange}
      point={props.point}
      screens={screens}
      initialScreen="menu"
    />
  );
}

function LinkedGroupScreen({ sheet, sheets, onUnlink }: SheetLinkPopoverProps) {
  const { close } = usePopoverNav();
  const groupSiblings = sheets.filter(
    (s) => s.linkGroupId === sheet.linkGroupId && s.id !== sheet.id,
  );
  return (
    <div className={MENU_SHAPE}>
      <PopoverHeader title="Linked with" />
      {groupSiblings.map((sibling) => (
        <div key={sibling.id} className={SIBLING_LINE}>
          <SheetDot sheet={sibling} />
          <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
            {sibling.name}
          </span>
        </div>
      ))}
      <div className="my-1 border-t border-edge-subtle" />
      <button
        type="button"
        className={ITEM}
        onClick={() => { close(); onUnlink(); }}
      >
        <Unlink size={13} /> Unlink
      </button>
    </div>
  );
}

function LinkTargetPickerScreen({ sheet, sheets, onLinkTo }: SheetLinkPopoverProps) {
  const { close } = usePopoverNav();
  const candidates = sheets.filter((s) => s.id !== sheet.id);
  if (candidates.length === 0) {
    return (
      <div className={MENU_SHAPE}>
        <PopoverHeader title="Link to" />
        <p className="px-2 py-2 text-2xs text-fg-faint">
          Create at least one more sheet to link this one.
        </p>
      </div>
    );
  }
  const handlePick = (sourceId: string) => {
    onLinkTo(sourceId);
    close();
  };
  return (
    <div className={MENU_SHAPE}>
      <PopoverHeader title="Link to" />
      {candidates.map((s) => (
        <button
          key={s.id}
          type="button"
          className={ITEM}
          onClick={() => handlePick(s.id)}
        >
          <SheetDot sheet={s} />
          <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">
            {s.name}
          </span>
        </button>
      ))}
    </div>
  );
}

function SheetDot({ sheet }: { sheet: Sheet }) {
  const isMain = sheet.id === MAIN_SHEET_ID;
  return (
    <span
      className={
        isMain
          ? 'w-2.5 h-2.5 rounded-full bg-transparent border border-edge-strong shrink-0'
          : 'w-2.5 h-2.5 rounded-full bg-edge-strong shrink-0'
      }
      style={sheet.color ? { background: sheet.color } : undefined}
    />
  );
}
