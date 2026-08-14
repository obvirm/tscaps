import { AppDialog } from '@ui/_shared/components/Dialog/AppDialog';
import { AppErrorMessage, getAppErrorTitle } from '@ui/_shared/components/AppErrorMessage/AppErrorMessage';
import { BTN_PRIMARY_SM } from '@ui/_shared/styles/buttons';
import { useIsMobileViewport } from '@ui/_shared/hooks/useIsMobileViewport';
import type { AppError } from '@core/errors/domain/AppError';

interface PreviewLoadFailedDialogProps {
  readonly error: AppError;
  readonly onBackToProjects: () => void;
}

/**
 * Modal surfaced when the editor's preview could not open the
 * project's video. The editor is unusable without a preview, so every
 * path out of the dialog — the button, ESC, the close affordance —
 * leads back to the projects list.
 */
export function PreviewLoadFailedDialog({ error, onBackToProjects }: PreviewLoadFailedDialogProps) {
  const isMobile = useIsMobileViewport();
  return (
    <AppDialog
      open
      onClose={onBackToProjects}
      closeOnOutsideClick={false}
      size="md"
      title={getAppErrorTitle(error)}
    >
      <div className="space-y-4">
        <AppErrorMessage error={error} isMobile={isMobile} />
        <div className="flex justify-end pt-1">
          <button type="button" className={BTN_PRIMARY_SM} onClick={onBackToProjects} autoFocus>
            Back to projects
          </button>
        </div>
      </div>
    </AppDialog>
  );
}
