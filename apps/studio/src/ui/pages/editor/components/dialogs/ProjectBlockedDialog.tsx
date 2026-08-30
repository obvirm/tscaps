import { AppDialog } from '@ui/_shared/components/Dialog/AppDialog';
import { AppErrorMessage, getAppErrorTitle } from '@ui/_shared/components/AppErrorMessage/AppErrorMessage';
import { BTN_PRIMARY_SM } from '@ui/_shared/styles/buttons';
import { useIsMobileViewport } from '@ui/_shared/hooks/useIsMobileViewport';
import type { AppError } from '@core/errors/domain/AppError';

interface ProjectBlockedDialogProps {
  readonly error: AppError;
  readonly onBackToProjects: () => void;
}

/**
 * Modal for a failure that leaves the editor with no project to show —
 * it never opened, or its preview never loaded. There is nothing to
 * work on behind the dialog, so every path out of it — the button,
 * ESC, the close affordance — leads back to the projects list.
 */
export function ProjectBlockedDialog({ error, onBackToProjects }: ProjectBlockedDialogProps) {
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
