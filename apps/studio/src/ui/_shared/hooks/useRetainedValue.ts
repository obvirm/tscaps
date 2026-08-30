import { useRef } from 'react';

/**
 * The value while it is there, and the last one it held once it is gone.
 *
 * A surface driven by `value !== null` — a dialog, a popover — stays
 * mounted through its exit animation, so whatever it reads from the live
 * value during those milliseconds is the empty state: a name that reads
 * "undefined" while the box fades out. Reading through this keeps the
 * last real value on screen until the surface is actually gone.
 */
export function useRetainedValue<T>(value: T | null): T | null {
  const retained = useRef<T | null>(value);
  if (value !== null) retained.current = value;
  return value ?? retained.current;
}
