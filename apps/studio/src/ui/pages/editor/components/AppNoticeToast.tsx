import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Toast } from '@ui/_shared/components/Toast/Toast';
import { getAppErrorTitle, requiresManualDismissal, useAppErrorShortDescription } from '@ui/_shared/components/AppErrorMessage/AppErrorMessage';
import type { AppError } from '@core/errors/domain/AppError';
import type { AppNoticeChannel } from '@core/errors/services/AppNoticeChannel';

const AUTO_DISMISS_MS = 12000;

interface AppNoticeToastProps {
  readonly channel: AppNoticeChannel;
}

/**
 * Corner notice for non-blocking `AppError` events broadcast through
 * the shared notice channel. Title and short description come from
 * the app-wide error catalog, so a new error type only needs an
 * entry there — no change to this toast. Whether it waits to be
 * dismissed or fades on its own is carried by the notice.
 */
export function AppNoticeToast({ channel }: AppNoticeToastProps) {
  const [error, setError] = useState<AppError | null>(null);
  useEffect(() => channel.subscribe((next) => setError(next)), [channel]);
  if (!error) return null;
  return <PublishedNotice error={error} onDismiss={() => setError(null)} />;
}

/**
 * Mounted only once there is something to say, so the copy hooks run
 * against a real error instead of a placeholder.
 */
function PublishedNotice({ error, onDismiss }: { readonly error: AppError; readonly onDismiss: () => void }) {
  const description = useAppErrorShortDescription(error);
  return (
    <Toast
      open
      position="bottom-right"
      tone="error"
      icon={<AlertTriangle size={16} />}
      title={getAppErrorTitle(error)}
      description={description}
      {...(requiresManualDismissal(error) ? {} : { duration: AUTO_DISMISS_MS })}
      onDismiss={onDismiss}
    />
  );
}
