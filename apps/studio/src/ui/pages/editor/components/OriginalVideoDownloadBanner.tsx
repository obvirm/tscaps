import { AlertTriangle } from 'lucide-react';
import type { AppError } from '@core/errors/domain/AppError';
import { getAppErrorTitle, useAppErrorShortDescription } from '@ui/_shared/components/AppErrorMessage/AppErrorMessage';

interface OriginalVideoDownloadBannerProps {
  readonly error: AppError;
  readonly onBackToProjects: () => void;
}

/**
 * Strip shown above the editor chrome when the project's original
 * video never landed. It takes its own room in the layout rather than
 * floating over the toolbar, because it stays for as long as the
 * project is open and there is nothing to dismiss it with.
 *
 * "Back to projects" is the only action: at this point there is no
 * local file to offer, so reopening the project is what restarts the
 * fetch.
 */
export function OriginalVideoDownloadBanner({ error, onBackToProjects }: OriginalVideoDownloadBannerProps) {
  const description = useAppErrorShortDescription(error);
  return (
    <div
      role="alert"
      className="w-full shrink-0 mb-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-md border border-danger/40 bg-danger/10 px-4 py-2"
    >
      <AlertTriangle size={16} strokeWidth={2.5} className="text-danger shrink-0" aria-hidden="true" />
      <span className="text-sm text-fg-primary">{getAppErrorTitle(error)}.</span>
      <span className="text-sm text-fg-muted">{description}</span>
      <button
        type="button"
        onClick={onBackToProjects}
        className="text-sm font-medium text-danger/85 underline underline-offset-2 hover:text-danger focus-visible:outline-none focus-visible:text-danger"
      >
        Back to projects
      </button>
    </div>
  );
}
