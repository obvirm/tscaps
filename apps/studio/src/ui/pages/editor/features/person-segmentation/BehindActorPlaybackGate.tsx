import { useEffect } from 'react';
import { BehindActorPlaybackGateController } from '@presentation/person-segmentation/controllers/BehindActorPlaybackGateController';
import { PreviewSurfacePlaybackGate } from '@presentation/person-segmentation/PreviewSurfacePlaybackGate';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { usePersonSegmentation } from '@ui/_shared/contexts/modules/PersonSegmentationContext';
import { usePreview } from '@ui/_shared/contexts/modules/PreviewContext';

/**
 * Mounts the hold that keeps the video from playing through a caption
 * nobody has measured yet. Renders nothing; what the hold looks like
 * is the progress pill's job.
 *
 * Leaving the editor also ends the background measuring: it decodes a
 * video for a project nobody is looking at any more, and what it has
 * learned so far is written out on the way.
 */
export function BehindActorPlaybackGate() {
  const editor = useEditor();
  const personSegmentation = usePersonSegmentation();
  const previewSurface = usePreview().surface;

  useEffect(() => {
    const controller = new BehindActorPlaybackGateController(
      editor.store,
      personSegmentation.loadedCacheStore,
      personSegmentation.captionedRanges,
      personSegmentation.incrementalAnalyzer,
      personSegmentation.analysisGateStore,
      new PreviewSurfacePlaybackGate(previewSurface),
    );
    controller.start();
    return () => {
      controller.stop();
      personSegmentation.incrementalAnalyzer.stop();
    };
  }, [editor.store, personSegmentation, previewSurface]);

  return null;
}
