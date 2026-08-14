import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

interface InfoTipProps {
  text: string;
  /** Accessible name, since the marker itself reads only as an "i". */
  label: string;
}

/**
 * Small `i` marker that reveals an explanation on hover or focus. For a
 * control whose name cannot carry the whole story without turning the
 * form into prose.
 */
export function InfoTip({ text, label }: InfoTipProps) {
  return (
    <Tooltip text={text}>
      <button
        type="button"
        aria-label={label}
        className={
          'inline-flex items-center justify-center w-3.5 h-3.5 rounded-pill ' +
          'border border-edge-medium text-fg-faint text-[9px] leading-none ' +
          'hover:border-edge-strong hover:text-fg-secondary ' +
          'transition-colors duration-quick ease-standard cursor-help'
        }
      >
        i
      </button>
    </Tooltip>
  );
}
