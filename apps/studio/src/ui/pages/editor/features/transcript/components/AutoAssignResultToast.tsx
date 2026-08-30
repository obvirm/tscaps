import { Wand2 } from 'lucide-react';
import { Toast, TOAST_AUTO_DISMISS_MS } from '@ui/_shared/components/Toast/Toast';
import type { SheetMatcherRunResult } from '@core/sheet-matchers/domain/SheetMatcher';

export interface AutoAssignResultToastState {
  /** Remount key so back-to-back runs restart the auto-dismiss timer. */
  readonly key: number;
  readonly result: SheetMatcherRunResult;
  readonly sheetName: string;
}

interface AutoAssignResultToastProps {
  readonly state: AutoAssignResultToastState | null;
  readonly onDismiss: () => void;
}

/**
 * Outcome notice for a "Group scenes" run: how many words or scenes
 * moved to the chosen sheet, or that nothing matched. The noun follows
 * the granularity the matcher reported, since a word-level matcher
 * carves scenes apart and counting them would say nothing.
 * Auto-dismisses.
 */
export function AutoAssignResultToast({ state, onDismiss }: AutoAssignResultToastProps) {
  if (state === null) return null;

  const { granularity, movedCount } = state.result;
  const noun = granularity === 'word' ? 'word' : 'scene';
  const title = movedCount === 0
    ? 'Nothing to move'
    : `Moved ${movedCount} ${noun}${movedCount === 1 ? '' : 's'} to ${state.sheetName}`;

  return (
    <Toast
      key={state.key}
      open
      position="bottom-right"
      tone={movedCount === 0 ? 'info' : 'success'}
      icon={<Wand2 size={16} strokeWidth={2.5} />}
      title={title}
      {...(movedCount === 0 && { description: `Everything matching is already on ${state.sheetName}.` })}
      duration={TOAST_AUTO_DISMISS_MS}
      onDismiss={onDismiss}
    />
  );
}
