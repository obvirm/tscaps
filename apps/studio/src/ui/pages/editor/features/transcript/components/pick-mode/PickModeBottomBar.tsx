interface PickModeBottomBarProps {
  selectionCount: number;
  selectionDurationSeconds: number;
  accentColor: string;
  confirmLabel: string;
  clearLabel: string;
  canConfirm: boolean;
  showClear: boolean;
  onConfirm: () => void;
  onClear: () => void;
}

const CONFIRM_BTN =
  'inline-flex items-center h-8 px-3 rounded-xs text-xs font-medium border-none cursor-pointer ' +
  'bg-accent text-white ' +
  'transition-colors duration-quick ease-standard ' +
  'hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-accent';

const CLEAR_BTN =
  'inline-flex items-center h-8 px-2.5 rounded-xs text-xs bg-transparent border-none cursor-pointer ' +
  'text-fg-secondary hover:text-fg-primary hover:bg-surface-2 ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2';

/**
 * Sticky bottom chrome for a scene pick session. Anchors to the
 * bottom of the transcript scroll area and summarises the running
 * selection alongside the primary confirm action; the destructive
 * "clear" affordance appears only when the session started with a
 * non-empty selection, so removing content stays an explicit choice.
 * Rendered on a raised surface with an upward shadow so it reads as
 * its own layer floating above the scrolling scene list.
 */
export function PickModeBottomBar({
  selectionCount,
  selectionDurationSeconds,
  accentColor,
  confirmLabel,
  clearLabel,
  canConfirm,
  showClear,
  onConfirm,
  onClear,
}: PickModeBottomBarProps) {
  return (
    <div className="sticky bottom-0 z-20 bg-surface-2 border-t border-edge-medium shadow-[0_-6px_10px_-8px_rgba(0,0,0,0.35)] mt-2">
      <div className="flex items-stretch">
        <span
          className="w-[4px] shrink-0"
          style={{ background: accentColor }}
          aria-hidden
        />
        <div className="flex items-center justify-between gap-2 px-3 py-2 flex-1 min-w-0">
          <span className="text-2xs font-mono tabular-nums text-fg-secondary shrink-0">
            {formatSummary(selectionCount, selectionDurationSeconds)}
          </span>
          <div className="flex items-center gap-1.5">
            {showClear && (
              <button type="button" className={CLEAR_BTN} onClick={onClear}>
                {clearLabel}
              </button>
            )}
            <button
              type="button"
              className={CONFIRM_BTN}
              onClick={onConfirm}
              disabled={!canConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatSummary(count: number, durationSeconds: number): string {
  const scenePart = count === 1 ? '1 scene' : `${count} scenes`;
  if (durationSeconds <= 0) return scenePart;
  return `${scenePart} · ${durationSeconds.toFixed(1)}s`;
}
