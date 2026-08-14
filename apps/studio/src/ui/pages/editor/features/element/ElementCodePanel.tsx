import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { css as cssLang } from '@codemirror/lang-css';
import type { ElementStyle } from '@core/elements/domain/ElementStyles';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { CodeEditorField } from '@ui/_shared/components/CodeEditorField/CodeEditorField';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { useCurrentTheme } from '@ui/_shared/hooks/useCurrentTheme';

const FLUSH_DEBOUNCE_MS = 250;
const EDITOR_HEIGHT = '260px';
const CSS_EXTENSIONS = [cssLang()];

const placeholderFor = (timingVariable: string) => `color: gold;

animation: pop 0.4s var(${timingVariable}) ease both;

@keyframes pop {
  from { scale: 0.4; opacity: 0 }
}`;

interface ElementCodePanelProps {
  elementId: string;
  kind: ElementKind;
  fragment: ElementStyle | null;
}

/**
 * The CSS written against one element. Declarations only — the selector
 * is added when the stylesheet is assembled, so the text stays about the
 * element and moving it elsewhere needs no rewriting. `&` reaches the
 * element again for states and descendants, and `@keyframes` written
 * here belong to this element alone.
 *
 * Keystrokes reach the store on a short debounce, so styling is
 * something the user watches happen rather than something they commit to
 * before seeing. Half-written CSS is no hazard on the way there: a rule
 * left open is sealed before it reaches the page.
 */
export const ElementCodePanel = memo(function ElementCodePanel({ elementId, kind, fragment }: ElementCodePanelProps) {
  const elements = useElements();
  const { cssValidator, timingVariableResolver } = elements.services;
  const theme = useCurrentTheme();
  const stored = fragment?.css ?? '';

  const [draft, setDraft] = useState(stored);
  const [isFocused, setIsFocused] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWriteRef = useRef<string | null>(null);

  // Re-seeded when the panel switches element, and when the stored text
  // moves under a field nobody is typing in — an undo, or the clear
  // button. Holding off while focused is what keeps the debounced write
  // from racing the keystrokes that produced it.
  const [seed, setSeed] = useState({ elementId, stored });
  if (seed.elementId !== elementId || (!isFocused && seed.stored !== stored)) {
    setSeed({ elementId, stored });
    setDraft(stored);
  }

  const flushPendingWrite = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const pending = pendingWriteRef.current;
    pendingWriteRef.current = null;
    if (pending !== null) elements.actions.setCss.execute(elementId, kind, pending);
  }, [elements, elementId, kind]);

  // Leaving mid-debounce must not lose the edit. The cleanup closes over
  // the element the text was typed against, so it lands on that one even
  // when the reason for leaving is a switch to another.
  useEffect(() => flushPendingWrite, [flushPendingWrite]);

  const handleChange = useCallback((next: string) => {
    setDraft(next);
    pendingWriteRef.current = next;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(flushPendingWrite, FLUSH_DEBOUNCE_MS);
  }, [flushPendingWrite]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    flushPendingWrite();
  }, [flushPendingWrite]);

  const problems = useMemo(
    () => cssValidator.validate(draft, kind).map((problem) => problem.message),
    [cssValidator, draft, kind],
  );

  const timingVariable = timingVariableResolver.resolve(kind, ElementAnimationScope.SELF);

  return (
    <Section title="CSS">
      <CodeEditorField
        value={draft}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        languageExtensions={CSS_EXTENSIONS}
        theme={theme}
        height={EDITOR_HEIGHT}
        dialogTitle="Element CSS"
        placeholder={placeholderFor(timingVariable)}
        problems={problems}
      />
      <p className="m-0 text-2xs text-fg-muted leading-snug">
        Wins over the template. Animations need{' '}
        <code className="font-mono">var({timingVariable})</code> as their delay.
      </p>
    </Section>
  );
});
