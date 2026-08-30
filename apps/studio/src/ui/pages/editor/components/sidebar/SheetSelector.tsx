import { useState } from 'react';
import { Link, Link2, Plus, X } from 'lucide-react';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import type { SheetCreationOption } from '@core/sheets/domain/SheetCreationOption';
import { ConfirmDialog } from '@ui/_shared/components/Dialog/ConfirmDialog';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { useRetainedValue } from '@ui/_shared/hooks/useRetainedValue';
import { AddSheetPopover } from '@ui/pages/editor/components/sidebar/AddSheetPopover';
import { EditSheetDialog, type EditSheetDialogResult } from '@ui/pages/editor/components/sidebar/EditSheetDialog';
import { SheetSettingsPopover } from '@ui/pages/editor/components/sidebar/SheetSettingsPopover';
import { SheetLinkPopover } from '@ui/pages/editor/components/sidebar/SheetLinkPopover';

interface SheetSelectorProps {
  sheets: Sheet[];
  activeSheetId: string;
  onSetActive: (sheetId: string) => void;
  onCreate: (name: string) => unknown;
  /** Sheets the project can add by name. Empty hides the menu. */
  creationOptions: ReadonlyArray<SheetCreationOption>;
  onCreateFromOption: (option: SheetCreationOption) => void;
  onRename: (sheetId: string, name: string) => void;
  onDelete: (sheetId: string) => void;
  onCopyStylesFromSheet: (targetSheetId: string, sourceSheetId: string) => void;
  onLinkSheet: (targetSheetId: string, sourceSheetId: string) => void;
  onUnlinkSheet: (sheetId: string) => void;
  onResetSheetToTemplateDefaults: (sheetId: string) => void;
}

const CHIP_BASE =
  'group/chip inline-flex items-center gap-2 pl-2.5 pr-1.5 h-8 rounded-sm border text-sm font-medium ' +
  'transition-[background-color,border-color,box-shadow] duration-quick ease-standard';
const CHIP_INACTIVE = `${CHIP_BASE} bg-transparent border-edge-medium hover:bg-surface-2 hover:border-edge-strong`;
const CHIP_ACTIVE = `${CHIP_BASE} bg-surface-3 shadow-raised`;

const CHIP_SELECT_BASE =
  'inline-flex items-center gap-2 bg-transparent border-none p-0 cursor-pointer min-w-0 outline-none ' +
  'focus-visible:text-fg-primary';
const CHIP_SELECT_INACTIVE = `${CHIP_SELECT_BASE} text-fg-secondary group-hover/chip:text-fg-primary`;
const CHIP_SELECT_ACTIVE = `${CHIP_SELECT_BASE} text-fg-primary`;

const CHIP_DOT = 'w-2.5 h-2.5 rounded-full bg-edge-strong shrink-0 ring-1 ring-inset ring-black/30';

const ADD_SHEET_TOOLTIP =
  'Add a new sheet. Sheets let you define different looks and assign them to scenes.';
const ADD_SHEET_BUTTON =
  'inline-flex items-center justify-center w-8 h-8 rounded-sm border border-dashed border-edge-medium ' +
  'bg-transparent text-fg-faint cursor-pointer transition-colors duration-quick ease-standard ' +
  'hover:bg-surface-2 hover:border-edge-strong hover:text-fg-secondary ' +
  'focus-visible:outline-none focus-visible:border-accent focus-visible:text-fg-secondary';

const CHIP_ICON_BASE =
  'inline-flex items-center justify-center w-5 h-5 rounded-xs border-none bg-transparent cursor-pointer ' +
  'transition-colors duration-quick ease-standard ' +
  'focus-visible:outline-none';
const CHIP_DELETE = `${CHIP_ICON_BASE} text-fg-faint hover:bg-danger/15 hover:text-danger focus-visible:bg-danger/15 focus-visible:text-danger`;
const CHIP_LINK_UNLINKED = `${CHIP_ICON_BASE} text-fg-faint hover:bg-surface-3 hover:text-fg-secondary focus-visible:bg-surface-3 focus-visible:text-fg-secondary`;
const CHIP_LINK_LINKED = `${CHIP_ICON_BASE} text-accent hover:bg-surface-3 focus-visible:bg-surface-3`;

interface MenuState {
  sheet: Sheet;
  point: { x: number; y: number };
}

interface LinkMenuState {
  sheet: Sheet;
  point: { x: number; y: number };
}

export function SheetSelector({
  sheets,
  activeSheetId,
  onSetActive,
  onCreate,
  creationOptions,
  onCreateFromOption,
  onRename,
  onDelete,
  onCopyStylesFromSheet,
  onLinkSheet,
  onUnlinkSheet,
  onResetSheetToTemplateDefaults,
}: SheetSelectorProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  // Settings popover state. Both left-click on the active chip and
  // right-click on any chip open this popover anchored under the chip;
  // right-click is just an alternative entry point for discoverability.
  const [menu, setMenu] = useState<MenuState | null>(null);
  // Link popover state. Separate popover so the chain icon can be its own
  // affordance regardless of which chip is active.
  const [linkMenu, setLinkMenu] = useState<LinkMenuState | null>(null);
  // Sheet currently being renamed (drives EditSheetDialog). Decoupled
  // from the popover so the popover can close cleanly before the dialog
  // animates in.
  const [renaming, setRenaming] = useState<Sheet | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Sheet | null>(null);
  // Both dialogs outlive their subject by one exit animation, so they read
  // the sheet through the retainer and keep showing its name while closing.
  const renamingSheet = useRetainedValue(renaming);
  const deletingSheet = useRetainedValue(pendingDelete);

  if (sheets.length === 0) return null;

  const isMultiSheet = sheets.length > 1;
  const wrapperClass = isMultiSheet
    ? 'sticky top-0 z-10 bg-surface-1 py-2 border-b border-edge-medium flex items-center flex-wrap gap-1.5'
    : 'pb-3 border-b border-edge-subtle flex items-center flex-wrap gap-1.5';

  const openMenuUnder = (sheet: Sheet, element: Element) => {
    const rect = element.getBoundingClientRect();
    setMenu({ sheet, point: { x: rect.left, y: rect.bottom + 4 } });
  };

  const openLinkMenuUnder = (sheet: Sheet, element: Element) => {
    const rect = element.getBoundingClientRect();
    setLinkMenu({ sheet, point: { x: rect.left, y: rect.bottom + 4 } });
  };

  const handleSelectClick = (sheet: Sheet, e: React.MouseEvent<HTMLButtonElement>) => {
    if (sheet.id === activeSheetId) {
      openMenuUnder(sheet, e.currentTarget);
    } else {
      onSetActive(sheet.id);
    }
  };

  const handleContextMenu = (sheet: Sheet, e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    openMenuUnder(sheet, e.currentTarget);
  };

  const handleCreateConfirm = (result: EditSheetDialogResult) => {
    setCreateOpen(false);
    onCreate(result.name);
  };

  const handleRenameConfirm = (sheet: Sheet, result: EditSheetDialogResult) => {
    setRenaming(null);
    if (result.name !== sheet.name) onRename(sheet.id, result.name);
  };

  return (
    <>
      <div className={wrapperClass}>
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeSheetId;
          const isMain = sheet.id === MAIN_SHEET_ID;
          const activeBorderStyle = isActive
            ? { borderColor: sheet.color ?? 'rgb(var(--color-accent))' }
            : undefined;
          return (
            <div
              key={sheet.id}
              className={isActive ? CHIP_ACTIVE : CHIP_INACTIVE}
              style={activeBorderStyle}
              onContextMenu={(e) => handleContextMenu(sheet, e)}
            >
              <Tooltip text={isActive ? 'Open sheet options' : 'Switch to this sheet'} position="top">
                <button
                  type="button"
                  className={isActive ? CHIP_SELECT_ACTIVE : CHIP_SELECT_INACTIVE}
                  onClick={(e) => handleSelectClick(sheet, e)}
                >
                  <span
                    className={CHIP_DOT}
                    style={sheet.color ? { background: sheet.color } : undefined}
                    data-main={isMain ? 'true' : undefined}
                  />
                  <span className="whitespace-nowrap max-w-[140px] overflow-hidden text-ellipsis">
                    {sheet.name}
                  </span>
                </button>
              </Tooltip>
              <ChipLinkButton
                sheet={sheet}
                sheets={sheets}
                onOpen={(el) => openLinkMenuUnder(sheet, el)}
              />
              {!isMain && (
                <Tooltip text={`Delete sheet "${sheet.name}"`} position="top">
                  <button
                    type="button"
                    className={CHIP_DELETE}
                    onClick={() => setPendingDelete(sheet)}
                    aria-label={`Delete sheet ${sheet.name}`}
                  >
                    <X size={12} />
                  </button>
                </Tooltip>
              )}
            </div>
          );
        })}
        {creationOptions.length > 0 ? (
          <AddSheetPopover
            open={addMenuOpen}
            onOpenChange={setAddMenuOpen}
            triggerTooltip={ADD_SHEET_TOOLTIP}
            trigger={
              <button className={ADD_SHEET_BUTTON} aria-label="Add sheet">
                <Plus size={14} />
              </button>
            }
            creationOptions={creationOptions}
            onCreateFromOption={onCreateFromOption}
            onPickCustom={() => setCreateOpen(true)}
          />
        ) : (
          <Tooltip text={ADD_SHEET_TOOLTIP} position="bottom">
            <button
              className={ADD_SHEET_BUTTON}
              onClick={() => setCreateOpen(true)}
              aria-label="Add sheet"
            >
              <Plus size={14} />
            </button>
          </Tooltip>
        )}
      </div>

      {menu && (
        <SheetSettingsPopover
          open
          onOpenChange={(o) => { if (!o) setMenu(null); }}
          point={menu.point}
          sheet={menu.sheet}
          sheets={sheets}
          onRequestRename={() => { setMenu(null); setRenaming(menu.sheet); }}
          onCopyStylesFromSheet={(sourceId) => onCopyStylesFromSheet(menu.sheet.id, sourceId)}
          onLinkTo={(sourceId) => { setMenu(null); onLinkSheet(menu.sheet.id, sourceId); }}
          onUnlink={() => { setMenu(null); onUnlinkSheet(menu.sheet.id); }}
          onResetToTemplateDefaults={() => { setMenu(null); onResetSheetToTemplateDefaults(menu.sheet.id); }}
        />
      )}

      {linkMenu && (
        <SheetLinkPopover
          open
          onOpenChange={(o) => { if (!o) setLinkMenu(null); }}
          point={linkMenu.point}
          sheet={linkMenu.sheet}
          sheets={sheets}
          onLinkTo={(sourceId) => { setLinkMenu(null); onLinkSheet(linkMenu.sheet.id, sourceId); }}
          onUnlink={() => { setLinkMenu(null); onUnlinkSheet(linkMenu.sheet.id); }}
        />
      )}

      <EditSheetDialog
        open={createOpen}
        sheet={null}
        onConfirm={handleCreateConfirm}
        onCancel={() => setCreateOpen(false)}
      />

      <EditSheetDialog
        open={renaming !== null}
        sheet={renamingSheet}
        onConfirm={(result) => { if (renaming) handleRenameConfirm(renaming, result); }}
        onCancel={() => setRenaming(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        message={`Delete sheet "${deletingSheet?.name ?? ''}"? Scenes using it will fall back to Main.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => { if (pendingDelete) onDelete(pendingDelete.id); setPendingDelete(null); }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

interface ChipLinkButtonProps {
  sheet: Sheet;
  sheets: ReadonlyArray<Sheet>;
  onOpen: (element: Element) => void;
}

function ChipLinkButton({ sheet, sheets, onOpen }: ChipLinkButtonProps) {
  const isLinked = sheet.linkGroupId !== null;
  const groupSize = isLinked
    ? sheets.filter((s) => s.linkGroupId === sheet.linkGroupId).length
    : 0;
  const tooltip = isLinked
    ? `Linked with ${groupSize - 1} other sheet${groupSize - 1 === 1 ? '' : 's'}`
    : 'Link to another sheet';
  const ariaLabel = isLinked ? `Unlink sheet ${sheet.name}` : `Link sheet ${sheet.name}`;
  const Icon = isLinked ? Link : Link2;
  return (
    <Tooltip text={tooltip} position="top">
      <button
        type="button"
        className={isLinked ? CHIP_LINK_LINKED : CHIP_LINK_UNLINKED}
        onClick={(e) => onOpen(e.currentTarget)}
        aria-label={ariaLabel}
        aria-pressed={isLinked}
      >
        <Icon size={12} />
      </button>
    </Tooltip>
  );
}
