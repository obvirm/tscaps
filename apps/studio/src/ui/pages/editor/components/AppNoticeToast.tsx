import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Toast } from '@ui/_shared/components/Toast/Toast';
import { getAppErrorTitle, requiresManualDismissal, useAppErrorShortDescription } from '@ui/_shared/components/AppErrorMessage/AppErrorMessage';
import type { AppError } from '@core/errors/domain/AppError';
import type { AppErrorName } from '@core/errors/domain/AppErrorName';
import type { AppNoticeChannel } from '@core/errors/services/AppNoticeChannel';

const AUTO_DISMISS_MS = 12000;

interface AppNoticeToastProps {
  readonly channel: AppNoticeChannel;
}

/**
 * Corner notices for non-blocking `AppError` events broadcast through
 * the shared notice channel. Title and short description come from
 * the app-wide error catalog, so a new error type only needs an
 * entry there — no change to this toast. Whether one waits to be
 * dismissed or fades on its own is carried by the notice.
 *
 * Unrelated failures stack rather than replace each other: a phase
 * that degrades two things has two things to say. A repeat of the
 * same failure replaces the notice already on screen instead of
 * putting a second copy of it beside the first.
 */
export function AppNoticeToast({ channel }: AppNoticeToastProps) {
  const [notices, setNotices] = useState<readonly AppError[]>([]);
  useEffect(() => channel.subscribe((next) => {
    setNotices((shown) => [...shown.filter((error) => error.name !== next.name), next]);
  }), [channel]);
  const dismiss = useCallback((name: AppErrorName) => {
    setNotices((shown) => shown.filter((error) => error.name !== name));
  }, []);
  return (
    <>
      {notices.map((error) => (
        <PublishedNotice key={error.name} error={error} onDismiss={() => dismiss(error.name)} />
      ))}
    </>
  );
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
