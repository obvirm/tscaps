import { memo, useState, type ReactNode } from 'react';
import CodeMirror, { type Extension } from '@uiw/react-codemirror';
import * as Dialog from '@radix-ui/react-dialog';
import { Maximize2, X } from 'lucide-react';
import type { Theme } from '@presentation/theme/controllers/ThemeController';
import { useIsMobileViewport } from '@ui/_shared/hooks/useIsMobileViewport';

interface CodeEditorFieldProps {
  value: string;
  onChange: (next: string) => void;
  onFocus?: (() => void) | undefined;
  /** Fires when the editor loses focus, including on the way into the expanded dialog. */
  onBlur?: (() => void) | undefined;
  languageExtensions: Extension[];
  theme: Theme;
  /** CSS length for the inline editor. The expanded one is always tall. */
  height: string;
  /** Title of the expanded dialog, and what the expand button announces. */
  dialogTitle: string;
  /** Rendered above the editor, below any problems. */
  intro?: ReactNode;
  /** Example content shown while the editor is empty. */
  placeholder?: string | undefined;
  /**
   * What is wrong with the current text, one entry per problem. Rendered
   * as an inline notice; purely informational, since the field never
   * refuses a value.
   */
  problems?: ReadonlyArray<string> | undefined;
}

const EDITOR_BASIC_SETUP = {
  lineNumbers: true,
  foldGutter: true,
  highlightActiveLine: true,
  autocompletion: true,
  bracketMatching: true,
};

const EXPAND_BUTTON_CLASS =
  'absolute top-2 right-2 z-10 inline-flex items-center justify-center w-8 h-8 rounded-xs '
  + 'bg-surface-2/80 backdrop-blur-sm border border-edge-subtle text-fg-muted cursor-pointer '
  + 'transition-colors duration-quick ease-standard hover:text-fg-secondary hover:border-edge-strong '
  + 'focus-visible:outline-none focus-visible:border-accent focus-visible:text-fg-secondary';

const DIALOG_BUTTON_CLASS =
  'inline-flex items-center justify-center w-8 h-8 rounded-xs bg-transparent border border-edge-subtle '
  + 'text-fg-muted cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:text-fg-secondary hover:border-edge-strong '
  + 'focus-visible:outline-none focus-visible:border-accent focus-visible:text-fg-secondary';

/**
 * A code editor sized for a sidebar, with an expand-to-dialog escape
 * hatch for when the sidebar is too narrow to think in.
 *
 * Fully controlled and unbuffered: every keystroke reaches `onChange`.
 * How often that becomes a real write — a debounce, a commit on blur —
 * is the owner's decision, because it depends on what the text drives.
 */
export const CodeEditorField = memo(function CodeEditorField({
  value,
  onChange,
  onFocus,
  onBlur,
  languageExtensions,
  theme,
  height,
  dialogTitle,
  intro,
  placeholder,
  problems,
}: CodeEditorFieldProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isMobileViewport = useIsMobileViewport();

  return (
    <div className="flex flex-col gap-2">
      {intro}
      {problems && problems.length > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-1 text-xs text-warning bg-warning/10 border border-warning/30 rounded-xs px-2 py-2"
        >
          {problems.map((problem) => <p key={problem} className="m-0 leading-snug">{problem}</p>)}
        </div>
      )}
      <div className="relative rounded-xs overflow-hidden border border-edge-subtle">
        <CodeMirror
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          {...(placeholder === undefined ? {} : { placeholder })}
          extensions={languageExtensions}
          theme={theme}
          height={height}
          basicSetup={EDITOR_BASIC_SETUP}
        />
        {/* Sidebar is narrow on desktop, useless on mobile. */}
        {!isMobileViewport && (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            aria-label={`Expand ${dialogTitle}`}
            title="Expand editor"
            className={EXPAND_BUTTON_CLASS}
          >
            <Maximize2 size={12} />
          </button>
        )}
      </div>
      <Dialog.Root open={isExpanded} onOpenChange={setIsExpanded}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[1000] bg-black/60 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[1001] -translate-x-1/2 -translate-y-1/2 bg-surface-2 border border-edge-subtle rounded-md shadow-md w-[90vw] max-w-[1200px] flex flex-col gap-3 p-5 focus:outline-none data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out">
            <div className="flex items-center justify-between gap-2">
              <Dialog.Title className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-secondary m-0">
                {dialogTitle}
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Edit the same source in an expanded view.
              </Dialog.Description>
              <Dialog.Close aria-label="Close" className={DIALOG_BUTTON_CLASS}>
                <X size={14} />
              </Dialog.Close>
            </div>
            <div className="rounded-xs overflow-hidden border border-edge-subtle">
              <CodeMirror
                value={value}
                onChange={onChange}
                onFocus={onFocus}
                onBlur={onBlur}
                {...(placeholder === undefined ? {} : { placeholder })}
                extensions={languageExtensions}
                theme={theme}
                height="80vh"
                basicSetup={EDITOR_BASIC_SETUP}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
});
