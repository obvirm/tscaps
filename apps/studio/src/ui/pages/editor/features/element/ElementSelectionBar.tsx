import { ChevronRight } from 'lucide-react';
import type { Document } from '@tscaps/engine';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { ELEMENT_KIND_LABELS } from '@ui/_shared/components/element-fields/ElementKindLabels';
import { useInspectedElement } from '@ui/pages/editor/features/element/useInspectedElement';
import { useEditorWorkspaceStore } from '@ui/pages/editor/contexts/EditorWorkspaceContext';
import { useIsElementInspectorOpen } from '@ui/pages/editor/hooks/useIsElementInspectorOpen';

interface ElementSelectionBarProps {
  document: Document | null;
  selectionController: OverlaySelectionController;
}

const BAR_CLASS =
  'shrink-0 w-full flex items-center gap-2 px-2 py-2 text-left '
  + 'bg-surface-1 border border-edge-subtle rounded-md cursor-pointer '
  + 'transition-colors duration-quick ease-standard '
  + 'hover:border-edge-medium hover:bg-surface-2 '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

const KIND_PILL_CLASS =
  'shrink-0 px-2 py-1 rounded-sm bg-surface-3 text-fg-muted '
  + 'font-mono text-3xs uppercase tracking-[0.06em] leading-none';

/**
 * The way back into the inspector after it was closed on an element
 * still marked in the preview, and the only weight the surface carries
 * in that state: one row naming what is marked.
 *
 * It comes and goes with the selection ring rather than with the pick,
 * so the panel is only offered for an element the user can see.
 */
export function ElementSelectionBar({ document, selectionController }: ElementSelectionBarProps) {
  const workspaceStore = useEditorWorkspaceStore();
  const isInspectorOpen = useIsElementInspectorOpen();
  const element = useInspectedElement(selectionController, document);

  if (isInspectorOpen || !element) return null;

  return (
    <button
      type="button"
      className={BAR_CLASS}
      onClick={() => workspaceStore.setInspectorOpen(true)}
    >
      <span className={KIND_PILL_CLASS}>{ELEMENT_KIND_LABELS[element.kind]}</span>
      <span className="text-sm font-medium text-fg-primary truncate min-w-0">{element.name}</span>
      <span className="ml-auto shrink-0 flex items-center gap-1 text-xs text-fg-muted">
        Edit style
        <ChevronRight size={14} strokeWidth={2} />
      </span>
    </button>
  );
}
