import { useEffect, useRef } from 'react';

/**
 * Counts a toast's time down and fires once the budget runs out.
 *
 * While `held` is true the countdown stops and later resumes from where
 * it left off, so a toast someone is reading never expires under them.
 * An `undefined` budget means the toast is persistent and nothing fires.
 *
 * `onElapsed` is read through a ref, so a caller passing an inline
 * callback does not restart the countdown on every one of its renders.
 */
export function useToastDismissTimer(durationMs: number | undefined, held: boolean, onElapsed: () => void): void {
  const remainingMsRef = useRef(durationMs ?? 0);
  const onElapsedRef = useRef(onElapsed);

  useEffect(() => {
    onElapsedRef.current = onElapsed;
  });

  useEffect(() => {
    remainingMsRef.current = durationMs ?? 0;
  }, [durationMs]);

  useEffect(() => {
    if (durationMs === undefined || held) return;
    const startedAt = performance.now();
    const timer = setTimeout(() => onElapsedRef.current(), remainingMsRef.current);
    return () => {
      clearTimeout(timer);
      remainingMsRef.current = Math.max(0, remainingMsRef.current - (performance.now() - startedAt));
    };
  }, [durationMs, held]);
}
