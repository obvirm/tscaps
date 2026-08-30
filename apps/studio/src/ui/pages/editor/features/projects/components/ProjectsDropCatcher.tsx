import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowUpFromLine } from 'lucide-react';
import { Toast, TOAST_AUTO_DISMISS_MS } from '@ui/_shared/components/Toast/Toast';
import {
  ACCEPTED_VIDEO_LABEL,
  ACCEPTED_VIDEO_TYPES,
  VIDEO_UNSUPPORTED_MESSAGE,
} from '@ui/_shared/video/videoAcceptance';

const PROJECT_FILE_EXTENSION = '.tscaps';

interface ProjectsDropCatcherProps {
  readonly onVideo: (file: File) => void;
  /**
   * Pre-flight fired before a dropped video is handed over. Return
   * `true` to indicate the drop was handled elsewhere and the file must
   * not be loaded.
   */
  readonly onVideoIntent?: () => boolean;
  /** When given, a dropped `.tscaps` file is imported instead of refused. */
  readonly onProjectFile?: (file: File) => void;
}

// Under the dialog layers (1000+) and the toast stack (900): an overlay
// that covered an open modal would hide the very thing explaining why
// the drop is about to be refused.
const OVERLAY =
  'fixed inset-0 z-[800] flex items-center justify-center ' +
  'bg-surface-0/85 backdrop-blur-sm p-6 sm:p-10 pointer-events-none animate-fade-in';

const OVERLAY_INNER =
  'w-full h-full max-w-[880px] max-h-[520px] rounded-lg ' +
  'border-2 border-dashed border-accent bg-surface-1/60 ' +
  'flex flex-col items-center justify-center gap-4 text-center px-8';

const OVERLAY_TITLE =
  'text-2xl sm:text-3xl font-semibold tracking-[-0.022em] text-fg-primary m-0';

const OVERLAY_HINT =
  'font-mono text-[13px] uppercase tracking-[0.1em] text-fg-faint m-0';

/**
 * Page-wide drop target for the projects list. Watches
 * `dragenter/over/leave/drop` on the window so a video starts a project
 * from anywhere on the page, not only from the "New project" button.
 * Shows a full-viewport overlay for the length of the drag and refuses
 * unreadable formats through a toast.
 */
export function ProjectsDropCatcher({ onVideo, onVideoIntent, onProjectFile }: ProjectsDropCatcherProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragDepthRef = useRef(0);

  const accept = useCallback((file: File) => {
    if (onProjectFile && file.name.toLowerCase().endsWith(PROJECT_FILE_EXTENSION)) {
      setError(null);
      onProjectFile(file);
      return;
    }
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      setError(VIDEO_UNSUPPORTED_MESSAGE);
      return;
    }
    // The same gate the "New project" button runs. A drop that skipped
    // it would walk straight past an exhausted quota.
    if (onVideoIntent?.()) return;
    setError(null);
    onVideo(file);
  }, [onVideo, onVideoIntent, onProjectFile]);

  useEffect(() => {
    const dragCarriesFile = (event: DragEvent): boolean =>
      event.dataTransfer?.types.includes('Files') ?? false;

    // `dragenter` and `dragleave` also fire while crossing the boundary
    // of every element under the pointer, so the overlay tracks how deep
    // the drag is rather than toggling on each pair.
    const handleDragEnter = (event: DragEvent) => {
      if (!dragCarriesFile(event)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      if (dragDepthRef.current === 1) setIsDragging(true);
    };

    const handleDragOver = (event: DragEvent) => {
      if (!dragCarriesFile(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!dragCarriesFile(event)) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDragging(false);
    };

    // Without `preventDefault` the browser navigates away to the dropped
    // file, taking the unsaved page with it.
    const handleDrop = (event: DragEvent) => {
      if (!dragCarriesFile(event)) return;
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDragging(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) accept(file);
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [accept]);

  const formatHint = onProjectFile ? `${ACCEPTED_VIDEO_LABEL} · TSCAPS` : ACCEPTED_VIDEO_LABEL;

  return (
    <>
      {isDragging && (
        <div className={OVERLAY} aria-hidden="true">
          <div className={OVERLAY_INNER}>
            <ArrowUpFromLine size={40} strokeWidth={1.6} className="text-accent" />
            <p className={OVERLAY_TITLE}>Drop the video.</p>
            <p className={OVERLAY_HINT}>{formatHint}</p>
          </div>
        </div>
      )}
      {error && (
        <Toast
          open
          position="bottom-right"
          tone="error"
          icon={<AlertTriangle size={16} />}
          title={error}
          duration={TOAST_AUTO_DISMISS_MS}
          onDismiss={() => setError(null)}
        />
      )}
    </>
  );
}
