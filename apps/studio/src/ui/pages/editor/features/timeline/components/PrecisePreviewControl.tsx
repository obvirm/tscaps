import { useCallback, useState, useSyncExternalStore } from 'react';
import { usePreview } from '@ui/_shared/contexts/modules/PreviewContext';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';
import { PrecisePreviewPopover } from '@ui/pages/editor/features/timeline/components/PrecisePreviewPopover';
import type { PreviewProxyGenerationStore } from '@core/preview/store/PreviewProxyGenerationStore';
import { REASONS_WORTH_OFFERING_GENERATION } from '@core/preview/domain/VideoPreview';

function useGenerationSnapshot(store: PreviewProxyGenerationStore) {
  const subscribe = useCallback((cb: () => void) => {
    store.addEventListener('change', cb);
    return () => store.removeEventListener('change', cb);
  }, [store]);
  const phase = useSyncExternalStore(subscribe, useCallback(() => store.phase, [store]));
  const percent = useSyncExternalStore(subscribe, useCallback(() => store.percent, [store]));
  return { phase, percent };
}

/**
 * Self-gating mount for the fast-preview affordance: renders only when
 * generating on demand is still worth offering. A session with the
 * pipeline off has nothing to offer, and a failed encode already
 * surfaces its own notice.
 */
export function PrecisePreviewControl() {
  const preview = usePreview();
  const editorStore = useEditorStore();
  const [open, setOpen] = useState(false);
  const generation = useGenerationSnapshot(preview.proxyGenerationStore);

  const subscribeToEditor = useCallback((cb: () => void) => {
    editorStore.addEventListener('change', cb);
    return () => editorStore.removeEventListener('change', cb);
  }, [editorStore]);
  const reason = useSyncExternalStore(subscribeToEditor, useCallback(() => {
    const preview = editorStore.snapshot().video.preview;
    return preview?.kind === 'original' ? preview.reason : null;
  }, [editorStore]));
  const originalAtHand = useSyncExternalStore(subscribeToEditor, useCallback(
    () => editorStore.snapshot().video.file !== null,
    [editorStore],
  ));

  if (reason === null || !REASONS_WORTH_OFFERING_GENERATION.has(reason)) return null;

  return (
    <PrecisePreviewPopover
      open={open}
      onOpenChange={setOpen}
      reason={reason}
      phase={generation.phase}
      percent={generation.percent}
      canGenerate={originalAtHand && generation.phase !== 'generating'}
      onGenerate={() => void preview.actions.generateProxy.execute()}
    />
  );
}
