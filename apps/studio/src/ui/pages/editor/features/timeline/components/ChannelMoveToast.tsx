import { useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { TimelineChannel } from '@presentation/timeline/services/TimelineChannelResolver';
import { TimelineChannelMoves, type TimelineChannelMove } from '@presentation/timeline/services/TimelineChannelMoves';
import { Toast, TOAST_AUTO_DISMISS_MS } from '@ui/_shared/components/Toast/Toast';

const moves = new TimelineChannelMoves();

interface ToastState {
  /** Remount key so back-to-back moves restart the auto-dismiss timer. */
  readonly key: number;
  readonly description: string;
}

interface Watched {
  readonly channels: ReadonlyArray<TimelineChannel>;
  readonly readChannelId: string | null;
}

interface ChannelMoveToastProps {
  channels: ReadonlyArray<TimelineChannel>;
  sheets: ReadonlyArray<Sheet>;
  readChannelId: string | null;
  /** Whether the timeline is the panel the reader is on. */
  isActive: boolean;
}

/**
 * Says so when an edit has taken a sheet out of the channel on screen.
 *
 * Which channel a sheet is read in follows from whether it overlaps
 * another, so dragging one word can move a whole sheet — and without
 * this the reader watches a stretch of their timeline vanish with
 * nothing said. The message carries the reason as well as the
 * destination, because "it moved" alone invites the reader to go looking
 * for what they broke.
 *
 * It only speaks while the timeline is on screen. Channels are a way of
 * reading this panel and mean nothing anywhere else, so a move made from
 * another mode took nothing away from the reader and is theirs to find
 * when they come back.
 */
export function ChannelMoveToast({ channels, sheets, readChannelId, isActive }: ChannelMoveToastProps) {
  const watchedRef = useRef<Watched>({ channels, readChannelId });
  const [toast, setToast] = useState<ToastState | null>(null);

  // Leaving the timeline takes its notice with it, during the render
  // that leaves rather than after one painted with both.
  const [wasActive, setWasActive] = useState(isActive);
  if (wasActive !== isActive) {
    setWasActive(isActive);
    if (!isActive) setToast(null);
  }

  useEffect(() => {
    const previous = watchedRef.current;
    // The baseline moves on while the panel is away too, so coming back
    // to the timeline never reports an edit made minutes ago elsewhere.
    watchedRef.current = { channels, readChannelId };
    if (!isActive || previous.readChannelId === null) return;
    const moved = moves.since(previous.channels, channels, previous.readChannelId);
    if (moved.length === 0) return;
    setToast({ key: Date.now(), description: describe(moved, sheets) });
  }, [channels, readChannelId, sheets, isActive]);

  return (
    <Toast
      key={toast?.key}
      open={toast !== null}
      position="bottom-right"
      tone="info"
      icon={<Layers size={16} strokeWidth={2.5} />}
      title="Text moved to another channel"
      description={toast?.description ?? ''}
      duration={TOAST_AUTO_DISMISS_MS}
      onDismiss={() => setToast(null)}
    />
  );
}

function describe(moved: ReadonlyArray<TimelineChannelMove>, sheets: ReadonlyArray<Sheet>): string {
  if (moved.length > 1) {
    return `${moved.length} sheets are now read in other channels.`;
  }
  const move = moved[0]!;
  const name = sheets.find((sheet) => sheet.id === move.sheetId)?.name ?? 'A sheet';
  return move.split
    ? `“${name}” now overlaps another sheet, so it has a channel of its own.`
    : `“${name}” no longer overlaps, so it is read in “${move.toChannelName}”.`;
}
