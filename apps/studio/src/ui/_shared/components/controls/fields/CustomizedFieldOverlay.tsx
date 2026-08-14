import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Code2 } from 'lucide-react';

interface CustomizedFieldOverlayProps {
  /** Whether the sheet's own CSS has taken this control over. Renders the control untouched when false. */
  customized: boolean;
  /** The control this covers, named as the user sees it. */
  label: string;
  /**
   * Ids of the controls this covers, which name the variables the
   * stylesheet stopped reading. Left out where the takeover has no
   * variable behind it — a declaration edited in place is one — and
   * the spoken sentence then says what happened without naming how.
   */
  controlIds?: ReadonlyArray<string> | undefined;
  children: ReactNode;
}

const PILL_TEXT = 'Your CSS controls this';

const WRAP = 'group/customized relative';
const DIMMED = 'opacity-50 pointer-events-none';

const PILL_LAYER =
  'absolute inset-0 flex items-center justify-center pointer-events-none '
  + 'opacity-0 transition-opacity duration-base ease-standard '
  + '[@media(hover:hover)]:group-hover/customized:opacity-100 '
  + 'group-focus-within/customized:opacity-100 '
  + 'group-data-[revealed]/customized:opacity-100';

const PILL =
  'inline-flex items-center gap-2 px-3 py-1 rounded-pill text-xs font-medium '
  + 'bg-surface-3 text-fg-secondary border border-edge-medium shadow-sm '
  + 'translate-y-1 transition-transform duration-base ease-emphasized '
  + '[@media(hover:hover)]:group-hover/customized:translate-y-0 '
  + 'group-focus-within/customized:translate-y-0 '
  + 'group-data-[revealed]/customized:translate-y-0';

/**
 * Covers a control the sheet's own CSS has taken over, and keeps it on
 * screen.
 *
 * Hiding it would be worse: the value is still stored and still emitted,
 * so the control has not stopped existing, it has stopped being read.
 * Dimming it without saying why is the state this exists to end, because
 * a control that quietly does nothing reads as a broken editor rather
 * than as a consequence of an edit.
 *
 * The visible wording names no variable on purpose. Whoever reaches this
 * state edited CSS, or asked for an edit and got one, and the useful
 * first fact is which of the two places now owns the value. The precise
 * one is there for assistive technology and for anyone who goes looking.
 */
export function CustomizedFieldOverlay({ customized, label, controlIds, children }: CustomizedFieldOverlayProps) {
  const [tapRevealed, setTapRevealed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tapRevealed) return;
    const dismissIfOutside = (target: EventTarget | null) => {
      if (target instanceof Node && wrapRef.current?.contains(target)) return;
      setTapRevealed(false);
    };
    const onPointerDown = (event: PointerEvent) => dismissIfOutside(event.target);
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [tapRevealed]);

  if (!customized) return <>{children}</>;

  return (
    <div
      ref={wrapRef}
      className={WRAP}
      data-revealed={tapRevealed ? '' : undefined}
      onClick={() => setTapRevealed(true)}
    >
      <div className={DIMMED}>{children}</div>
      <span className={PILL_LAYER} aria-hidden>
        <span className={PILL}>
          <Code2 size={12} />
          <span>{PILL_TEXT}</span>
        </span>
      </span>
      <span className="sr-only">
        {`${label} is set by your stylesheet`
          + (controlIds && controlIds.length > 0
            ? `, which no longer reads ${controlIds.map((id) => `var(--tscaps-${id})`).join(' or ')}`
            : '')
          + '. Restore it to control this from here again.'}
      </span>
    </div>
  );
}
