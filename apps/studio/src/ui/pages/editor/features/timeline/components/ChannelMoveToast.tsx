import { useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { TimelineChannel } from '@presentation/timeline/services/TimelineChannelResolver';
import { TimelineChannelMoves, type TimelineChannelMove } from '@presentation/timeline/services/TimelineChannelMoves';
import { Toast, TOAST_AUTO_DISMISS_MS } from '@ui/_shared/components/Toast/Toast';

const moves = new TimelineChannelMoves();

interface ToastState {
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
 */
export function ChannelMoveToast({ channels, sheets, readChannelId }: ChannelMoveToastProps) {
  const watchedRef = useRef<Watched>({ channels, readChannelId });
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const previous = watchedRef.current;
    watchedRef.current = { channels, readChannelId };
    if (previous.readChannelId === null) return;
    const moved = moves.since(previous.channels, channels, previous.readChannelId);
    if (moved.length === 0) return;
    setToast({ key: Date.now(), description: describe(moved, sheets) });
  }, [channels, readChannelId, sheets]);

  return (
    <Toast
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
