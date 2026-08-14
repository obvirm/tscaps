import { RotateCcw } from 'lucide-react';
import { ELEMENT_KIND_LABELS } from '@ui/_shared/components/element-fields/ElementKindLabels';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import type { InspectedElement } from '@ui/pages/editor/features/element/useInspectedElement';

interface InspectedElementHeaderProps {
  element: InspectedElement;
  /** Whether the element has been told anything at all. */
  hasStyle: boolean;
  /** Puts the element back to the way its sheet renders it: fields, animations and CSS alike. */
  onClearStyle: () => void;
}

const KIND_PILL_CLASS =
  'shrink-0 px-2 py-1 rounded-sm bg-surface-3 text-fg-muted '
  + 'font-mono text-3xs uppercase tracking-[0.06em] leading-none';

const CLEAR_BUTTON_CLASS =
  'shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-xs bg-transparent border-none '
  + 'text-fg-faint cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:text-fg-secondary focus-visible:outline-none focus-visible:text-fg-secondary '
  + 'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-fg-faint';

/**
 * Says which element the panel is editing, and offers the one action
 * that applies to the whole element rather than to a single property.
 *
 * Names the element, never the panel: the panel follows what is picked
 * in the preview, so the pick is the only title it could carry.
 */
export function InspectedElementHeader({ element, hasStyle, onClearStyle }: InspectedElementHeaderProps) {
  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <span className={KIND_PILL_CLASS}>{ELEMENT_KIND_LABELS[element.kind]}</span>
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        {/* `truncate` clips whatever sticks out of the line box, so the
            line box has to hold the font's descenders: `leading-none`
            cut the tail off every g and y. */}
        <span className="text-sm text-fg-primary font-medium truncate leading-snug">{element.name}</span>
        {element.context && (
          <span className="text-2xs text-fg-faint truncate leading-snug">{element.context}</span>
        )}
      </div>
      <Tooltip text="Reset this element">
        <button
          type="button"
          onClick={onClearStyle}
          disabled={!hasStyle}
          aria-label="Reset this element"
          className={CLEAR_BUTTON_CLASS}
        >
          <RotateCcw size={15} strokeWidth={2} />
        </button>
      </Tooltip>
    </div>
  );
}
