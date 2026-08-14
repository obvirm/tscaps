import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';

export type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

/** The element each position anchors its toasts into. */
export type ToastStacks = Readonly<Record<ToastPosition, HTMLElement>>;

// A stack grows away from the edge its toasts enter from, so the newest
// one always sits against that edge: bottom stacks read in DOM order,
// top stacks read reversed.
//
// Every stack spans the viewport and places its toasts with `items-*`
// rather than anchoring itself to one side. That keeps the `transform`
// axis free for the toasts' own entrance and swipe, and lets a toast
// wider than a narrow phone shrink to fit instead of running off screen.
// `pointer-events-none` is what makes the full-width span harmless.
const STACK_CLASS: Readonly<Record<ToastPosition, string>> = {
  'top-left': 'fixed z-[900] top-4 inset-x-4 flex flex-col-reverse items-start gap-2 pointer-events-none',
  'top-center': 'fixed z-[900] top-4 inset-x-4 flex flex-col-reverse items-center gap-2 pointer-events-none',
  'top-right': 'fixed z-[900] top-4 inset-x-4 flex flex-col-reverse items-end gap-2 pointer-events-none',
  'bottom-left': 'fixed z-[900] bottom-4 inset-x-4 flex flex-col items-start gap-2 pointer-events-none',
  'bottom-center': 'fixed z-[900] bottom-4 inset-x-4 flex flex-col items-center gap-2 pointer-events-none',
  'bottom-right': 'fixed z-[900] bottom-4 inset-x-4 flex flex-col items-end gap-2 pointer-events-none',
};

const ToastStackContext = createContext<ToastStacks | null>(null);

/**
 * Hosts one stack container per screen position and hands them to the
 * toasts below, which portal themselves into the container matching their
 * position. Concurrent toasts that share a position then lay out beside
 * each other instead of covering one another up.
 *
 * The containers are attached to `document.body` for the provider's
 * lifetime, so a toast escapes any transform, overflow or stacking
 * context between it and the viewport.
 */
export function ToastStackProvider({ children }: { children: ReactNode }) {
  const [stacks] = useState(createStacks);

  useLayoutEffect(() => {
    for (const container of Object.values(stacks)) document.body.appendChild(container);
    return () => {
      for (const container of Object.values(stacks)) container.remove();
    };
  }, [stacks]);

  return <ToastStackContext.Provider value={stacks}>{children}</ToastStackContext.Provider>;
}

/** Reads the stack containers. Throws when no provider sits above the caller. */
export function useToastStacks(): ToastStacks {
  const stacks = useContext(ToastStackContext);
  if (stacks === null) throw new Error('A Toast was rendered outside a ToastStackProvider');
  return stacks;
}

function createStacks(): ToastStacks {
  return {
    'top-left': createStack('top-left'),
    'top-center': createStack('top-center'),
    'top-right': createStack('top-right'),
    'bottom-left': createStack('bottom-left'),
    'bottom-center': createStack('bottom-center'),
    'bottom-right': createStack('bottom-right'),
  };
}

function createStack(position: ToastPosition): HTMLElement {
  const container = document.createElement('div');
  container.className = STACK_CLASS[position];
  container.dataset.toastStack = position;
  return container;
}
