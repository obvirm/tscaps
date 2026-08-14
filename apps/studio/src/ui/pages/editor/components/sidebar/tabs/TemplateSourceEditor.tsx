import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { type Extension } from '@uiw/react-codemirror';
import type { Theme } from '@presentation/theme/controllers/ThemeController';
import { CodeEditorField } from '@ui/_shared/components/CodeEditorField/CodeEditorField';

const FLUSH_DEBOUNCE_MS = 250;
const EDITOR_HEIGHT = '60vh';

interface TemplateSourceEditorProps {
  /** Identity of the sheet whose source this editor edits. */
  sheetId: string;
  /** Current source — the user's override when present, otherwise the
   * template's pristine source. */
  source: string;
  /** Whether the sheet currently carries an override for this source.
   * When this flips from `true` to `false` (template change or reset)
   * the local buffer re-syncs to `source` and any pending flush is dropped. */
  isOverridden: boolean;
  languageExtensions: Extension[];
  theme: Theme;
  onChange: (source: string) => void;
  /** Optional intro paragraph rendered above the editor. */
  intro?: ReactNode;
  /** Optional synchronous validator. Every string it returns is
   * rendered inline as a problem with the source. Purely informational —
   * the render path is responsible for its own fallback on parse failure. */
  validate?: (source: string) => ReadonlyArray<string>;
  /** Title shown in the maximized dialog. */
  dialogTitle: string;
}

/**
 * Editor for a per-sheet template source override (CSS or
 * `filters.svg`). Buffers keystrokes locally and forwards them to
 * `onChange` on a short debounce so the store and the render
 * pipeline don't run on every key press.
 */
export const TemplateSourceEditor = memo(function TemplateSourceEditor({
  sheetId,
  source,
  isOverridden,
  languageExtensions,
  theme,
  onChange,
  intro,
  validate,
  dialogTitle,
}: TemplateSourceEditorProps) {
  const [value, setValue] = useState<string>(source);
  const [problems, setProblems] = useState<ReadonlyArray<string>>(() =>
    validate ? validate(source) : [],
  );

  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [lastSheetId, setLastSheetId] = useState(sheetId);
  const [lastOverridePresence, setLastOverridePresence] = useState(isOverridden);
  if (lastSheetId !== sheetId || (lastOverridePresence && !isOverridden)) {
    setLastSheetId(sheetId);
    setLastOverridePresence(isOverridden);
    setValue(source);
    setProblems(validate ? validate(source) : []);
  } else if (lastOverridePresence !== isOverridden) {
    setLastOverridePresence(isOverridden);
  }

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [sheetId, isOverridden]);

  const handleChange = useCallback((next: string) => {
    setValue(next);
    if (validate) setProblems(validate(next));
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      onChange(next);
    }, FLUSH_DEBOUNCE_MS);
  }, [onChange, validate]);

  return (
    <CodeEditorField
      value={value}
      onChange={handleChange}
      languageExtensions={languageExtensions}
      theme={theme}
      height={EDITOR_HEIGHT}
      dialogTitle={dialogTitle}
      intro={intro}
      problems={problems}
    />
  );
});
