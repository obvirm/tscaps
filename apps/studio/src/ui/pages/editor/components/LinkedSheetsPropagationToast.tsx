import { useEffect, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import { Toast, TOAST_AUTO_DISMISS_MS } from '@ui/_shared/components/Toast/Toast';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';

interface ToastState {
  readonly key: number;
  readonly propagatedCount: number;
}

/**
 * Persistent hint that a style edit rode across a linked group. Fires
 * once per group per editing session so the first propagation is
 * discoverable but repeated edits stay silent. Auto-dismisses.
 */
export function LinkedSheetsPropagationToast() {
  const { linkedSheetsPropagationNotifier } = useSheets();
  const alreadyNotifiedGroupIdsRef = useRef<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    return linkedSheetsPropagationNotifier.subscribe(({ groupId, propagatedCount }) => {
      if (alreadyNotifiedGroupIdsRef.current.has(groupId)) return;
      alreadyNotifiedGroupIdsRef.current.add(groupId);
      setToast({ key: Date.now(), propagatedCount });
    });
  }, [linkedSheetsPropagationNotifier]);

  const description = toast === null
    ? ''
    : toast.propagatedCount === 1
      ? '1 linked sheet followed your edit.'
      : `${toast.propagatedCount} linked sheets followed your edit.`;

  return (
    <Toast
      open={toast !== null}
      position="bottom-right"
      tone="info"
      icon={<Link2 size={16} strokeWidth={2.5} />}
      title="Linked sheets updated"
      description={description}
      duration={TOAST_AUTO_DISMISS_MS}
      onDismiss={() => setToast(null)}
    />
  );
}
