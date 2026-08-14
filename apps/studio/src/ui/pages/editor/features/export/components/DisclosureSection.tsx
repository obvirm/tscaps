import type { ReactNode } from 'react';

interface DisclosureSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * Collapsible group for settings most people never change. Keeps the
 * dialog's default state down to the decisions that matter.
 */
export function DisclosureSection({ title, open, onToggle, children }: DisclosureSectionProps) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={
          'flex items-center gap-1.5 text-xs font-semibold text-fg-secondary tracking-[-0.005em] ' +
          'hover:text-fg-primary transition-colors duration-quick ease-standard ' +
          'cursor-pointer self-start'
        }
      >
        <svg
          aria-hidden
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`transition-transform duration-quick ease-standard ${open ? 'rotate-90' : ''}`}
        >
          <path d="M3 1.5L6.5 5L3 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {title}
      </button>
      {open && <div className="mt-3 animate-fade-in">{children}</div>}
    </div>
  );
}
